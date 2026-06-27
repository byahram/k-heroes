import os
import pickle
import numpy as np
from pypdf import PdfReader
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

def extract_chunks_from_pdf(pdf_path, chunk_size=600, overlap=150):
    """PDF에서 텍스트를 추출하고 오버랩을 두어 청킹합니다."""
    reader = PdfReader(pdf_path)
    full_text = ""
    for page in reader.pages:
        text = page.extract_text()
        if text:
            full_text += text + "\n"
            
    # 글자 수 기반 슬라이딩 윈도우 청킹
    chunks = []
    start = 0
    while start < len(full_text):
        end = start + chunk_size
        chunks.append(full_text[start:end].strip())
        start += (chunk_size - overlap)
    return chunks

def generate_embeddings(texts, model="text-embedding-3-small"):
    """여러 텍스트 청크들의 임베딩 벡터를 배치 생성합니다."""
    response = client.embeddings.create(
        input=texts,
        model=model
    )
    return [item.embedding for item in response.data]

def build_db(pdf_path, output_pickle_path):
    print("[INFO] PDF 텍스트 추출 및 청킹 중...")
    chunks = extract_chunks_from_pdf(pdf_path)
    print(f"[INFO] 총 {len(chunks)}개의 청크가 생성되었습니다.")
    
    print("[INFO] OpenAI 임베딩 생성 중...")
    # rate limit 방지를 위해 100개씩 batch 처리 권장
    embeddings = []
    batch_size = 100
    for i in range(0, len(chunks), batch_size):
        batch_texts = chunks[i:i+batch_size]
        batch_embeddings = generate_embeddings(batch_texts)
        embeddings.extend(batch_embeddings)
        print(f"  - [{i+len(batch_texts)}/{len(chunks)}] 임베딩 완료")
        
    # 메모리에 최적화하기 위해 데이터 패키징
    db_data = {
        "chunks": chunks,
        "embeddings": np.array(embeddings, dtype=np.float32) # 메모리 절약형 float32 지정
    }
    
    os.makedirs(os.path.dirname(output_pickle_path), exist_ok=True)
    with open(output_pickle_path, "wb") as f:
        pickle.dump(db_data, f)
    print(f"[SUCCESS] 인메모리 벡터 DB 파일 빌드 완료: {output_pickle_path}")

    # GCS 업로드 추가
    gcp_bucket_name = os.environ.get("GCP_BUCKET_NAME")
    gcp_project_id = os.environ.get("GCP_PROJECT_ID")
    if gcp_bucket_name:
        try:
            from google.cloud import storage
            client = storage.Client(project=gcp_project_id)
            bucket = client.bucket(gcp_bucket_name)
            filename = os.path.basename(output_pickle_path)
            blob = bucket.blob(f"assets/processed/{filename}")
            blob.upload_from_filename(output_pickle_path)
            print(f"[SUCCESS] GCS 업로드 완료: gs://{gcp_bucket_name}/assets/processed/{filename}")
        except Exception as e:
            print(f"[WARNING] GCS 업로드 중 오류 발생 (로컬 캐시만 유지): {e}")
    else:
        print("[INFO] GCP_BUCKET_NAME 설정이 없어 로컬 캐시로 저장 완료")

if __name__ == "__main__":
    pdf_path = "./backend/data/raw/고등학교_국사_(7차_교육과정).pdf"
    if not os.path.exists(pdf_path):
        pdf_path = "./data/raw/고등학교_국사_(7차_교육과정).pdf"
        
    output_path = "./backend/data/processed/history_db.pkl"
    if not os.path.exists(os.path.dirname(output_path)):
        output_path = "./data/processed/history_db.pkl"
        
    build_db(pdf_path, output_path)
