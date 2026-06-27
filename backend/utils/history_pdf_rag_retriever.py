import pickle
import numpy as np
import os
from openai import OpenAI
from rank_bm25 import BM25Okapi
from dotenv import load_dotenv

load_dotenv()

# 시대별 키워드 매핑 (메타데이터 리랭킹에 활용)
ERA_KEYWORDS = {
    "조선 시대": ["조선", "한양", "임금", "왕조", "태조", "세종", "영조", "정조", "양반", "사림", "붕당"],
    "조선 후기": ["조선", "실학", "세도정치", "임진왜란", "병자호란", "영조", "정조", "고종", "개항", "강화도조약", "대한제국"],
    "일제강점기": ["일제", "강점기", "독립", "의병", "총독부", "만세", "임시정부", "신간회", "3·1", "광복"],
    "근현대": ["대통령", "정부", "현대", "전쟁", "민주", "공화국", "남북", "협상", "휴전"],
    "고려 시대": ["고려", "개경", "태조", "광종", "성종", "공민왕", "무신", "몽골", "삼별초", "금속활자"]
}

class InMemoryHistoryRAG:
    def __init__(self, db_pickle_path):
        self.client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        
        # 1. 파일 로드 (없을 경우 원본 PDF로부터 자동 빌드 수행)
        if not os.path.exists(db_pickle_path):
            print(f"[RAG] DB 파일({db_pickle_path})이 존재하지 않아 자동 빌드를 수행합니다...")
            base_dir = os.path.dirname(db_pickle_path)
            raw_pdf_path = os.path.join(base_dir, "..", "raw", "고등학교_국사_(7차_교육과정).pdf")
            
            # 파일명 NFD/NFC 정규화 차이 등으로 인해 경로가 없을 경우를 대비하여 폴더 스캔
            if not os.path.exists(raw_pdf_path):
                raw_dir = os.path.join(base_dir, "..", "raw")
                if os.path.exists(raw_dir):
                    for fname in os.listdir(raw_dir):
                        if "국사" in fname and fname.endswith(".pdf"):
                            raw_pdf_path = os.path.join(raw_dir, fname)
                            break
                            
            if os.path.exists(raw_pdf_path):
                from utils.history_pdf_db_builder import build_db
                os.makedirs(os.path.dirname(db_pickle_path), exist_ok=True)
                build_db(raw_pdf_path, db_pickle_path)
            else:
                raise FileNotFoundError(f"인메모리 RAG DB 파일 및 원본 PDF 파일을 찾을 수 없습니다: {db_pickle_path}")
            
        with open(db_pickle_path, "rb") as f:
            data = pickle.load(f)
            
        self.chunks = data["chunks"]
        self.embeddings = data["embeddings"] # shape: (N, Embedding_Dim)
        
        # 2. 키워드 검색용 BM25 인덱스 생성
        tokenized_corpus = [doc.split(" ") for doc in self.chunks]
        self.bm25 = BM25Okapi(tokenized_corpus)
        print(f"[RAG] 국사 교과서 {len(self.chunks)}개 청크 인메모리 로드 및 인덱싱 완료.")

    def _get_query_embedding(self, query):
        response = self.client.embeddings.create(
            input=[query],
            model="text-embedding-3-small"
        )
        return np.array(response.data[0].embedding, dtype=np.float32)

    def _check_era_match(self, chunk_text: str, era_tag: str) -> bool:
        if not era_tag:
            return False
        for era, keywords in ERA_KEYWORDS.items():
            if era in era_tag or era_tag in era:
                if any(kw in chunk_text for kw in keywords):
                    return True
        return False

    def retrieve(self, query, top_k=3, similarity_threshold=0.20, character_name=None, era_tag=None):
        """Sparse(BM25) + Dense(Cosine) 하이브리드 RRF 검색 및 메타데이터 리랭커 적용"""
        # A. Dense Vector Similarity 계산 (L2 정규화가 되어있는 임베딩의 내적)
        q_emb = self._get_query_embedding(query)
        cosine_scores = np.dot(self.embeddings, q_emb)
        
        # B. Sparse BM25 키워드 점수 계산
        tokenized_query = query.split(" ")
        bm25_scores = np.array(self.bm25.get_scores(tokenized_query))
        
        # C. RRF (Reciprocal Rank Fusion) 계산
        # 점수 순으로 인덱스 정렬해서 순위(rank) 매김
        dense_rank_indices = np.argsort(cosine_scores)[::-1]
        dense_ranks = np.zeros(len(self.chunks), dtype=np.int32)
        for rank, idx in enumerate(dense_rank_indices):
            dense_ranks[idx] = rank
            
        sparse_rank_indices = np.argsort(bm25_scores)[::-1]
        sparse_ranks = np.zeros(len(self.chunks), dtype=np.int32)
        for rank, idx in enumerate(sparse_rank_indices):
            sparse_ranks[idx] = rank
            
        # RRF Score = 1 / (60 + r_dense) + 1 / (60 + r_sparse)
        rrf_scores = 1.0 / (60.0 + dense_ranks) + 1.0 / (60.0 + sparse_ranks)
        
        # RRF 점수 정규화 (0 ~ 1 범위)
        max_rrf = np.max(rrf_scores) if np.max(rrf_scores) > 0 else 1.0
        normalized_rrf = rrf_scores / max_rrf
        
        # D. 메타데이터 리랭커 연산
        candidates = []
        for idx in range(len(self.chunks)):
            cos_score = float(cosine_scores[idx])
            
            # 최소 신뢰도 코사인 유사도 미만이면 1차 필터링
            if cos_score < similarity_threshold:
                continue
                
            chunk_text = self.chunks[idx]
            
            # 피처 기반 가중치(Boost) 계산
            character_boost = 0.0
            if character_name and character_name in chunk_text:
                character_boost = 0.3
                
            era_boost = 0.0
            if era_tag and self._check_era_match(chunk_text, era_tag):
                era_boost = 0.2
                
            # 최종 리랭크 스코어 계산
            rerank_score = float(normalized_rrf[idx] + character_boost + era_boost)
            
            candidates.append({
                "chunk": chunk_text,
                "score": cos_score,
                "rrf_score": float(rrf_scores[idx]),
                "normalized_rrf": float(normalized_rrf[idx]),
                "character_boost": character_boost,
                "era_boost": era_boost,
                "rerank_score": rerank_score
            })
            
        # E. 리랭크 스코어 기준으로 정렬 및 반환
        candidates.sort(key=lambda x: x["rerank_score"], reverse=True)
        return candidates[:top_k]

# 싱글톤 인스턴스 전역 관리 (실제 배포 시 임포트하여 사용)
_rag_instance = None

def get_rag_instance(db_path="./backend/data/processed/history_db.pkl"):
    global _rag_instance
    if _rag_instance is None:
        _rag_instance = InMemoryHistoryRAG(db_path)
    return _rag_instance
