import os
import glob
import pandas as pd
from typing import Tuple, List, Dict, Any

# 격동의 K-Heroes 역사 데이터 스키마 정의 (소문자 기준)
EXPECTED_COLUMNS = [
    "data_manage_no", "data_title_nm", "theme_nm", "lwprt_theme_nm", "cl_nm",
    "lwprt_cl_nm", "sbjt_nm", "middl_sbjt_nm", "sumry_cn", "main_thumb_url",
    "cntnts_url", "ctprvn_nm", "signgu_nm", "addr", "ctlstt_la", "ctlstt_lo",
    "regist_de", "relate_prsn_nm", "relate_stry_nm", "core_kwrd_cn", "opn_de"
]

def validate_csv_columns(file_path: str) -> Tuple[bool, str]:
    """
    CSV 파일의 컬럼명이 K-Heroes 기본 데이터 규격과 일치하는지 검증합니다.
    다른 컬럼이 있을 경우 사용자 오류 메시지를 반환합니다.
    """
    try:
        # 헤더만 읽어서 컬럼명 확인
        df_header = pd.read_csv(file_path, nrows=0)
        cols = [col.lower().strip() for col in df_header.columns]
        
        # 순서 상관 없이 컬럼셋 비교
        expected_set = set(EXPECTED_COLUMNS)
        cols_set = set(cols)
        
        if cols_set != expected_set:
            return False, "이 파일들과 다른 컬럼들이 들어간 CSV를 업로드 하면 그거에 맞는 코드는 아직 없습니다."
        return True, ""
    except Exception as e:
        return False, f"CSV 파일을 읽는 중 오류가 발생했습니다: {str(e)}"

def integrate_csv_datasets(raw_dir: str, processed_dir: str) -> Dict[str, Any]:
    """
    data/raw 디렉터리에 있는 모든 CSV 파일을 수집해 검증하고,
    CLTUR_ARTS와 PRSN으로 분류하여 병합 및 중복 제거를 거친 후 kf_area_total_merged.csv 마스터를 생성합니다.
    """
    os.makedirs(processed_dir, exist_ok=True)
    
    csv_pattern = os.path.join(raw_dir, "*.csv")
    csv_files = glob.glob(csv_pattern)
    
    if not csv_files:
        raise FileNotFoundError("정제할 원본 CSV 파일이 raw 폴더에 존재하지 않습니다.")
        
    cltur_dfs = []
    prsn_dfs = []
    
    # 1. 파일 검증 및 로드
    for file in csv_files:
        filename = os.path.basename(file)
        
        # 스키마 컬럼 검증
        is_valid, err_msg = validate_csv_columns(file)
        if not is_valid:
            raise ValueError(f"[{filename}] 검증 실패: {err_msg}")
            
        temp_df = pd.read_csv(file, encoding="utf-8")
        temp_df.columns = temp_df.columns.str.lower()
        
        if "cltur" in filename.lower() or "cltur_arts" in filename.upper():
            cltur_dfs.append(temp_df)
        elif "prsn" in filename.lower() or "prsn" in filename.upper():
            prsn_dfs.append(temp_df)
        else:
            # 기타 CSV에 대한 스키마 예외 처리
            raise ValueError(f"[{filename}] 이 파일들과 다른 컬럼들이 들어간 CSV를 업로드 하면 그거에 맞는 코드는 아직 없습니다.")
            
    # 2. 개별 그룹 머지 및 중복 제거
    cltur_merged = pd.DataFrame(columns=EXPECTED_COLUMNS)
    prsn_merged = pd.DataFrame(columns=EXPECTED_COLUMNS)
    
    if cltur_dfs:
        df_cltur = pd.concat(cltur_dfs, ignore_index=True)
        if "data_manage_no" in df_cltur.columns:
            cltur_merged = df_cltur.drop_duplicates(subset=["data_manage_no"], keep="first")
        else:
            cltur_merged = df_cltur
        cltur_merged["data_manage_keyword"] = "cltur"
        cltur_merged = cltur_merged.sort_values(by="data_manage_no").reset_index(drop=True)
        cltur_merged.to_csv(os.path.join(processed_dir, "kf_area_cltur_merged.csv"), index=False, encoding="utf-8-sig")
        
    if prsn_dfs:
        df_prsn = pd.concat(prsn_dfs, ignore_index=True)
        if "data_manage_no" in df_prsn.columns:
            prsn_merged = df_prsn.drop_duplicates(subset=["data_manage_no"], keep="first")
        else:
            prsn_merged = df_prsn
        prsn_merged["data_manage_keyword"] = "prsn"
        prsn_merged = prsn_merged.sort_values(by="data_manage_no").reset_index(drop=True)
        prsn_merged.to_csv(os.path.join(processed_dir, "kf_area_prsn_merged.csv"), index=False, encoding="utf-8-sig")
        
    # 3. 전체 마스터 통합
    all_dfs = []
    if not cltur_merged.empty:
        all_dfs.append(cltur_merged)
    if not prsn_merged.empty:
        all_dfs.append(prsn_merged)
        
    if not all_dfs:
        raise ValueError("병합할 데이터프레임이 존재하지 않습니다.")
        
    df_total = pd.concat(all_dfs, ignore_index=True)
    duplicate_keys = ["data_manage_no", "data_manage_keyword"]
    
    df_final = df_total.drop_duplicates(subset=duplicate_keys, keep="first")
    df_final = df_final.sort_values(by=duplicate_keys).reset_index(drop=True)
    
    master_path = os.path.join(processed_dir, "kf_area_total_merged.csv")
    df_final.to_csv(master_path, index=False, encoding="utf-8-sig")
    
    # GCS 업로드
    gcp_bucket_name = os.environ.get("GCP_BUCKET_NAME")
    gcp_project_id = os.environ.get("GCP_PROJECT_ID")
    gcs_uploaded = False
    
    if gcp_bucket_name:
        try:
            from google.cloud import storage
            client = storage.Client(project=gcp_project_id)
            bucket = client.bucket(gcp_bucket_name)
            blob = bucket.blob("assets/processed/kf_area_total_merged.csv")
            blob.upload_from_filename(master_path)
            gcs_uploaded = True
            print(f"[SUCCESS] 마스터 CSV GCS 업로드 완료: gs://{gcp_bucket_name}/assets/processed/kf_area_total_merged.csv")
        except Exception as e:
            print(f"[WARNING] 마스터 CSV GCS 업로드 실패: {e}")
            
    return {
        "status": "completed",
        "total_rows": len(df_final),
        "cltur_rows": len(df_final[df_final["data_manage_keyword"] == "cltur"]),
        "prsn_rows": len(df_final[df_final["data_manage_keyword"] == "prsn"]),
        "gcs_sync": gcs_uploaded,
        "local_path": master_path
    }
