import os
import shutil
import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session

from db.database import get_db
from router.v2.deps import require_content_admin
from utils.history_pdf_db_builder import build_db
from utils.rag_csv_processor import integrate_csv_datasets, validate_csv_columns
from db.seed import run_seed

# 전역 백그라운드 태스크 상태 맵
rag_task_status = {
    "pdf_build": {"status": "idle", "progress": "", "error": "", "target": ""},
    "csv_purify": {"status": "idle", "progress": "", "error": ""},
    "db_sync": {"status": "idle", "progress": "", "error": ""}
}

router = APIRouter(
    prefix="/api/v2/admin/rag",
    tags=["RAG Management Admin"],
    dependencies=[Depends(require_content_admin)]
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
RAW_DIR = os.path.join(BASE_DIR, "data", "raw")
PROCESSED_DIR = os.path.join(BASE_DIR, "data", "processed")

# Ensure directories exist
os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)

def get_gcs_bucket():
    gcp_bucket_name = os.environ.get("GCP_BUCKET_NAME")
    gcp_project_id = os.environ.get("GCP_PROJECT_ID")
    if not gcp_bucket_name:
        return None
    try:
        from google.cloud import storage
        client = storage.Client(project=gcp_project_id)
        return client.bucket(gcp_bucket_name)
    except Exception as e:
        print(f"[WARNING] GCS 클라이언트 초기화 오류: {e}")
        return None

def format_size(bytes_size: int) -> str:
    if bytes_size == 0:
        return "0 Bytes"
    units = ["Bytes", "KB", "MB", "GB"]
    i = 0
    while bytes_size >= 1024 and i < len(units) - 1:
        bytes_size /= 1024
        i += 1
    return f"{bytes_size:.2f} {units[i]}"

@router.get("/files")
def list_rag_files():
    """
    GCS 버킷에 보관된 원본(raw) 파일 및 정제(processed) 산출물 목록만 조회. (로컬은 스캔하지 않음)
    """
    raw_files = {}
    processed_files = {}
    
    bucket = get_gcs_bucket()
    if bucket:
        try:
            # Raw 폴더 조회
            blobs_raw = bucket.list_blobs(prefix="assets/raw/")
            for blob in blobs_raw:
                if blob.name == "assets/raw/":
                    continue
                fname = blob.name.replace("assets/raw/", "")
                if not fname:
                    continue
                ext = fname.split(".")[-1].upper()
                uploaded_str = blob.updated.strftime("%Y-%m-%d %H:%M") if blob.updated else "-"
                
                raw_files[fname] = {
                    "name": fname,
                    "size": format_size(blob.size or 0),
                    "type": "PDF" if ext == "PDF" else "CSV",
                    "uploaded_at": uploaded_str,
                    "source": "gcs",
                    "status": "completed"
                }
            
            # Processed 폴더 조회
            blobs_processed = bucket.list_blobs(prefix="assets/processed/")
            for blob in blobs_processed:
                if blob.name == "assets/processed/":
                    continue
                fname = blob.name.replace("assets/processed/", "")
                if not fname or fname == "characters.json": # characters.json은 스페이스 프로필 카드이므로 가공 파일 목록에서 제외
                    continue
                ext = fname.split(".")[-1].upper()
                uploaded_str = blob.updated.strftime("%Y-%m-%d %H:%M") if blob.updated else "-"
                
                processed_files[fname] = {
                    "name": fname,
                    "size": format_size(blob.size or 0),
                    "type": ext,
                    "uploaded_at": uploaded_str,
                    "source": "gcs"
                }
        except Exception as e:
            print(f"[WARNING] GCS 스캔 오류: {e}")
    else:
        print("[WARNING] GCS 설정이 없어 원격 파일을 조회할 수 없습니다.")

    # 현재 비동기 실행중인 PDF 빌드 대상의 상태 오버라이드
    active_pdf_build = rag_task_status["pdf_build"]
    if active_pdf_build["status"] == "running" and active_pdf_build["target"]:
        target_name = active_pdf_build["target"]
        if target_name in raw_files:
            raw_files[target_name]["status"] = "processing"

    return {
        "raw": list(raw_files.values()),
        "processed": list(processed_files.values()),
        "tasks": rag_task_status
    }

@router.post("/upload")
async def upload_rag_file(file: UploadFile = File(...)):
    """
    원본 PDF 혹은 CSV 파일을 업로드. (GCS에 업로드하고 로컬 임시 파일은 즉시 제거)
    """
    filename = file.filename
    ext = filename.split(".")[-1].lower()
    
    if ext not in ["pdf", "csv"]:
        raise HTTPException(status_code=400, detail="PDF 혹은 CSV 형식의 파일만 업로드할 수 있습니다.")
        
    local_path = os.path.join(RAW_DIR, filename)
    
    # 1. 로컬에 임시 저장 후 CSV 컬럼 검증
    try:
        with open(local_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        if ext == "csv":
            is_valid, err_msg = validate_csv_columns(local_path)
            if not is_valid:
                if os.path.exists(local_path):
                    os.remove(local_path)
                raise HTTPException(status_code=400, detail=err_msg)
    except HTTPException:
        raise
    except Exception as e:
        if os.path.exists(local_path):
            os.remove(local_path)
        raise HTTPException(status_code=500, detail=f"파일 업로드 처리 중 오류 발생: {str(e)}")

    # 2. GCS 업로드 및 로컬 캐시 즉시 제거
    bucket = get_gcs_bucket()
    if bucket:
        try:
            blob = bucket.blob(f"assets/raw/{filename}")
            blob.upload_from_filename(local_path)
            print(f"[SUCCESS] GCS 원본 업로드 완료: assets/raw/{filename}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"GCS 업로드 실패: {str(e)}")
        finally:
            if os.path.exists(local_path):
                os.remove(local_path)
    else:
        if os.path.exists(local_path):
            os.remove(local_path)
        raise HTTPException(status_code=500, detail="GCS 버킷이 연결되어 있지 않습니다.")
            
    return {"message": f"성공적으로 업로드 되었습니다: {filename}"}

@router.delete("/files/{file_name}")
def delete_rag_file(file_name: str):
    """
    GCS 버킷 내 원본 파일을 삭제.
    """
    local_path = os.path.join(RAW_DIR, file_name)
    if os.path.exists(local_path):
        os.remove(local_path)
        
    deleted_gcs = False
    bucket = get_gcs_bucket()
    if bucket:
        try:
            blob = bucket.blob(f"assets/raw/{file_name}")
            if blob.exists():
                blob.delete()
                deleted_gcs = True
        except Exception as e:
            print(f"[WARNING] GCS 파일 삭제 오류: {e}")
            raise HTTPException(status_code=500, detail=f"GCS 파일 삭제 중 오류 발생: {str(e)}")
            
    if not deleted_gcs:
        raise HTTPException(status_code=404, detail="삭제할 파일을 찾을 수 없습니다.")
        
    return {"message": f"성공적으로 삭제되었습니다: {file_name}"}


# =========================================================================
# 비동기 백그라운드 태스크 구현부
# =========================================================================

def bg_build_pdf_vector(filename: str):
    """PDF 임베딩 빌드 백그라운드 작업 (GCS에서 다운로드 후 완료 시 로컬 삭제)"""
    local_pdf_path = os.path.join(RAW_DIR, filename)
    local_pkl_name = filename.rsplit(".", 1)[0] + ".pkl"
    local_pkl_path = os.path.join(PROCESSED_DIR, local_pkl_name)
    
    try:
        rag_task_status["pdf_build"]["status"] = "running"
        rag_task_status["pdf_build"]["progress"] = "GCS에서 원본 PDF 다운로드 중..."
        rag_task_status["pdf_build"]["error"] = ""
        
        bucket = get_gcs_bucket()
        if not bucket:
            raise RuntimeError("GCS 버킷이 연결되어 있지 않습니다.")
            
        blob = bucket.blob(f"assets/raw/{filename}")
        if not blob.exists():
            raise FileNotFoundError(f"GCS 원본 폴더에서 파일을 찾을 수 없습니다: assets/raw/{filename}")
            
        blob.download_to_filename(local_pdf_path)
            
        rag_task_status["pdf_build"]["progress"] = "임베딩 연동 및 텍스트 청킹 분석 중..."
        
        # 실제 빌드 호출
        build_db(local_pdf_path, local_pkl_path)
        
        rag_task_status["pdf_build"]["status"] = "completed"
        rag_task_status["pdf_build"]["progress"] = "벡터 DB 가공 및 GCS 업로드 완료!"
    except Exception as e:
        print(f"[ERROR] RAG PDF 빌드 실패: {e}")
        rag_task_status["pdf_build"]["status"] = "failed"
        rag_task_status["pdf_build"]["error"] = str(e)
    finally:
        # 다운로드 및 가공 완료된 로컬 파일 즉시 청소
        if os.path.exists(local_pdf_path):
            os.remove(local_pdf_path)
        if os.path.exists(local_pkl_path):
            os.remove(local_pkl_path)

@router.post("/build-pdf")
def trigger_pdf_build(body: Dict[str, str], background_tasks: BackgroundTasks):
    """
    특정 PDF 원본 문서를 청킹하여 OpenAI 벡터 임베딩 DB(.pkl) 파일 생성을 시작.
    """
    filename = body.get("filename")
    if not filename:
        raise HTTPException(status_code=400, detail="filename 속성이 필요합니다.")
        
    if rag_task_status["pdf_build"]["status"] == "running":
        raise HTTPException(status_code=409, detail="이미 다른 PDF 임베딩 빌드가 실행 중입니다.")
        
    rag_task_status["pdf_build"]["target"] = filename
    background_tasks.add_task(bg_build_pdf_vector, filename)
    return {"message": "RAG 벡터 DB 빌드가 백그라운드에서 시작되었습니다."}


def bg_purify_csv():
    """CSV 통합 및 정제 백그라운드 작업 (GCS 다운로드 후 가공 및 로컬 삭제)"""
    try:
        rag_task_status["csv_purify"]["status"] = "running"
        rag_task_status["csv_purify"]["progress"] = "GCS에서 CSV 원본 다운로드 중..."
        rag_task_status["csv_purify"]["error"] = ""
        
        # 로컬 폴더 초기 청소
        for d in [RAW_DIR, PROCESSED_DIR]:
            for f in os.listdir(d):
                fpath = os.path.join(d, f)
                if os.path.isfile(fpath):
                    os.remove(fpath)
                    
        bucket = get_gcs_bucket()
        if not bucket:
            raise RuntimeError("GCS 버킷이 연결되어 있지 않습니다.")
            
        blobs = bucket.list_blobs(prefix="assets/raw/")
        downloaded_count = 0
        for blob in blobs:
            if blob.name.endswith(".csv"):
                fname = blob.name.replace("assets/raw/", "")
                if fname:
                    local_path = os.path.join(RAW_DIR, fname)
                    blob.download_to_filename(local_path)
                    downloaded_count += 1
                    
        if downloaded_count == 0:
            raise FileNotFoundError("GCS raw 폴더 내에 통합할 CSV 파일이 존재하지 않습니다.")
                        
        rag_task_status["csv_purify"]["progress"] = "중복 데이터 제거 및 마스터 CSV 병합 진행 중..."
        
        # 통합 처리 실행
        result = integrate_csv_datasets(RAW_DIR, PROCESSED_DIR)
        
        rag_task_status["csv_purify"]["status"] = "completed"
        rag_task_status["csv_purify"]["progress"] = (
            f"마스터 병합 완료! (총 {result['total_rows']}행 - 문화유산: {result['cltur_rows']}행, 인물: {result['prsn_rows']}행)"
        )
    except Exception as e:
        print(f"[ERROR] CSV 정제 실패: {e}")
        rag_task_status["csv_purify"]["status"] = "failed"
        rag_task_status["csv_purify"]["error"] = str(e)
    finally:
        # 다운로드 및 병합 완료 후 로컬 파일 전체 즉시 정리
        for d in [RAW_DIR, PROCESSED_DIR]:
            for f in os.listdir(d):
                fpath = os.path.join(d, f)
                if os.path.isfile(fpath):
                    os.remove(fpath)

@router.post("/purify-csv")
def trigger_csv_purify(background_tasks: BackgroundTasks):
    """
    raw 디렉터리에 업로드된 모든 CSV 문서를 수집하여 컬럼명 통일 및 중복 제거 후 마스터 데이터셋을 통합.
    """
    if rag_task_status["csv_purify"]["status"] == "running":
        raise HTTPException(status_code=409, detail="이미 다른 CSV 마스터 정제가 실행 중입니다.")
        
    background_tasks.add_task(bg_purify_csv)
    return {"message": "역사 데이터 정제 및 마스터 통합이 백그라운드에서 시작되었습니다."}


def bg_sync_db():
    """GPT 프로필 갱신 및 DB 동기화 백그라운드 작업"""
    master_csv = os.path.join(PROCESSED_DIR, "kf_area_total_merged.csv")
    try:
        rag_task_status["db_sync"]["status"] = "running"
        rag_task_status["db_sync"]["progress"] = "GCS에서 마스터 CSV 다운로드 중..."
        rag_task_status["db_sync"]["error"] = ""
        
        # GCS에서 마스터 CSV 다운로드
        bucket = get_gcs_bucket()
        if not bucket:
            raise RuntimeError("GCS 버킷이 연결되어 있지 않습니다.")
            
        blob = bucket.blob("assets/processed/kf_area_total_merged.csv")
        if not blob.exists():
            raise FileNotFoundError("GCS 버킷에서 kf_area_total_merged.csv를 찾을 수 없습니다. 먼저 정제를 실행하세요.")
            
        blob.download_to_filename(master_csv)
        
        # Step 1: scenario_generator.py 실행을 통해 OpenAI GPT 프로필 및 턴 텍스트 작성
        # text 모드로 구동하므로 DALL-E 이미지 생성은 생략(비용 절감 및 속도 향상)
        rag_task_status["db_sync"]["progress"] = "OpenAI 분석 및 GPT 인물 카드 텍스트 생성 중 (몇 분이 걸릴 수 있습니다)..."
        
        # scenario_generator 라이브러리 연동
        from scenario_generator import run_main_pipeline
        run_main_pipeline(target_char=None, mode="profiles-text")
        
        rag_task_status["db_sync"]["progress"] = "OpenAI 분석 완료! 생성된 인물 카드를 데이터베이스에 동기화 중..."
        
        # Step 2: DB 시드 진행
        run_seed(force=True)
        
        # GCS 동기화
        char_json_path = os.path.join(BASE_DIR, "backend", "data", "characters.json")
        if os.path.exists(char_json_path):
            blob = bucket.blob("assets/processed/characters.json")
            blob.upload_from_filename(char_json_path)
            print("[SUCCESS] characters.json GCS 백업 완료.")
            
        rag_task_status["db_sync"]["status"] = "completed"
        rag_task_status["db_sync"]["progress"] = "전체 캐릭터 프로필 갱신 및 PostgreSQL 데이터베이스 동기화 완료!"
    except Exception as e:
        print(f"[ERROR] DB 동기화/시드 실패: {e}")
        rag_task_status["db_sync"]["status"] = "failed"
        rag_task_status["db_sync"]["error"] = str(e)
    finally:
        # 가공 완료된 임시 마스터 파일 즉시 청소
        if os.path.exists(master_csv):
            os.remove(master_csv)

@router.post("/sync-db")
def trigger_db_sync(background_tasks: BackgroundTasks):
    """
    정제 완료된 마스터 CSV 데이터를 기반으로 GPT 인물 카드를 일괄 생성하고 데이터베이스(Supabase)에 동기화.
    """
    if rag_task_status["db_sync"]["status"] == "running":
        raise HTTPException(status_code=409, detail="이미 다른 캐릭터 프로필 갱신/동기화 태스크가 실행 중입니다.")
        
    bucket = get_gcs_bucket()
    if bucket:
        blob = bucket.blob("assets/processed/kf_area_total_merged.csv")
        if not blob.exists():
            raise HTTPException(status_code=400, detail="정제 완료된 마스터 CSV(kf_area_total_merged.csv)가 GCS에 존재하지 않습니다. 먼저 [데이터 정제 및 마스터 통합]을 실행하세요.")
    else:
        raise HTTPException(status_code=400, detail="GCS 버킷이 연결되어 있지 않아 정제 결과 유무를 파악할 수 없습니다.")
        
    background_tasks.add_task(bg_sync_db)
    return {"message": "인물 카드 갱신 및 DB 시딩 동기화가 백그라운드에서 시작되었습니다."}
