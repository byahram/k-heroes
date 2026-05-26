import os
import json
import pandas as pd

# 절대 경로 추적 세팅
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROCEED_DIR = os.path.join(BASE_DIR, 'data', 'proceed')

INPUT_FILE = os.path.join(PROCEED_DIR, 'kf_area_total_merged.csv')
FINAL_RAG_OUTPUT = os.path.join(PROCEED_DIR, 'kf_area_rag_data.json')


def synthesize_simulator_context(row):
    """
    지도 기반 최적화 및 도메인 정체성을 반영하여 자연어 본문을 합성합니다.
    """
    if row['data_manage_keyword'] == 'cltur':
        domain_ctx = "지역 이야기와 예술인에 관한 역사 기록"
        identity_tag = "예술인"
    else:
        domain_ctx = "지역 이야기와 지역 인물에 관한 역사 기록"
        identity_tag = "지역 인물"
        
    title = row['data_title_nm']
    summary = row['sumry_cn']
    related_person = row['relate_prsn_nm']
    
    # 필수 문장 빌드
    text_chunks = [
        f"[시뮬레이터 단서] 이 문서는 '{row['ctprvn_nm']}' 지역의 {domain_ctx}입니다.",
        f"자료의 명칭은 '{title}'이며, 관련된 역사적 사건 및 핵심 요약은 다음과 같습니다: '{summary}'",
        f"이 사건 및 현장과 밀접하게 연관된 핵심 {identity_tag}은 '{related_person}'입니다."
    ]
    
    # 선택 데이터 누락 처리 (방어 코드)
    if pd.notna(row.get('addr')) and str(row.get('addr')).strip() != '':
        text_chunks.append(f"이 역사적 현장의 구체적인 위치 및 주소는 '{row['addr']}' 입니다.")
        
    if pd.notna(row.get('core_kwrd_cn')) and str(row.get('core_kwrd_cn')).strip() != '':
        text_chunks.append(f"이 단서와 매칭되는 주요 역사 키워드는 [{row['core_kwrd_cn']}] 입니다.")
        
    if pd.notna(row.get('relate_stry_nm')) and str(row.get('relate_stry_nm')).strip() != '':
        text_chunks.append(f"이 장소와 인물에 얽힌 구체적인 비화 및 지역 이야기는 다음과 같습니다: '{row['relate_stry_nm']}'")
        
    return " ".join(text_chunks)


def main():
    print("[SCRIPTS] RAG 데이터셋 추출 자동화 스크립트 가동")
    print(f" ➔ 입력 파일: {INPUT_FILE}")
    print(f" ➔ 출력 파일: {FINAL_RAG_OUTPUT}")
    print("-" * 60)

    if not os.path.exists(INPUT_FILE):
        print(f"[Error] 마스터 통합 파일이 없습니다: {INPUT_FILE}")
        return

    # 데이터 로드
    df = pd.read_csv(INPUT_FILE, encoding='utf-8-sig')
    
    # 지도 UI 기반 시도명 누락 행 전면 필터링
    df_clean_sido = df.dropna(subset=['ctprvn_nm']).reset_index(drop=True)
    print(f"🧹 필터링 완료: {len(df)}행 ➔ {len(df_clean_sido)}행 가용 (누락 {len(df) - len(df_clean_sido)}개 제거)")

    rag_dataset = []

    for _, row in df_clean_sido.iterrows():
        # JSON 포맷 대응을 위해 NaN을 일괄 None으로 매핑
        row_dict = row.where(pd.notna(row), None).to_dict()
        
        # 자연어 컨텍스트 줄글 합성
        combined_context = synthesize_simulator_context(row)
        
        # 시군구 명칭 누락 방어
        sigungu_filter = row_dict.get("signgu_nm") if row_dict.get("signgu_nm") else "미지정"
        
        # 메타데이터 패키징
        metadata = {
            "source_id": row_dict.get("data_manage_no"),
            "domain_type": row_dict.get("data_manage_keyword"), # cltur(예술인) / prsn(지역인물)
            "theme": row_dict.get("theme_nm"),
            "category": row_dict.get("cl_nm"),
            "subject": row_dict.get("sbjt_nm"),
            "region_sido": row_dict.get("ctprvn_nm"),
            "region_sigungu": sigungu_filter,
            "related_person": row_dict.get("relate_prsn_nm"),
            "latitude": row_dict.get("ctlstt_la"),
            "longitude": row_dict.get("ctlstt_lo")
        }
        
        rag_dataset.append({
            "text": combined_context,
            "metadata": metadata
        })

    # JSON 마스터 파일 드롭
    with open(FINAL_RAG_OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(rag_dataset, f, ensure_ascii=False, indent=2)
        
    print("-" * 60)
    print(f"[성공] RAG 데이터셋 마스터 파일 생성 완료!")
    print(f" ➔ 생성된 총 레코드 수: {len(rag_dataset)}개")


if __name__ == "__main__":
    main()