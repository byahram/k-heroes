import os
import json
import time
import sys
import io
import base64
from typing import Dict, Any, List, Optional
import pandas as pd
from dotenv import load_dotenv
from openai import OpenAI
from google.cloud import storage
from utils.history_pdf_rag_retriever import get_rag_instance

# Setup project directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def _turn_sort_order(turn: dict) -> int:
    if "sort_order" in turn:
        return turn["sort_order"]
    return turn.get("turn_no", 1) - 1


def _turn_step_no(sort_order: int) -> int:
    return sort_order + 1
load_dotenv(os.path.join(BASE_DIR, "..", ".env"))

CHARACTERS_JSON_PATH = os.path.join(BASE_DIR, "data", "characters.json")
CSV_PATH = os.path.join(BASE_DIR, "data", "processed", "kf_area_total_merged.csv")

# OpenAI API 클라이언트 초기화
openai_api_key = os.environ.get("OPENAI_API_KEY")
if not openai_api_key:
    print("[WARNING] OPENAI_API_KEY 환경변수가 존재하지 않습니다. .env를 확인하십시오.")
    openai_client = None
else:
    openai_client = OpenAI(api_key=openai_api_key, timeout=180.0)

# Global variables from .env
GCP_PROJECT_ID = os.environ.get("GCP_PROJECT_ID")
GCP_BUCKET_NAME = os.environ.get("GCP_BUCKET_NAME")

# 생몰년도 및 시대 메타데이터 로드
HISTORICAL_LIFESPANS_PATH = os.path.join(BASE_DIR, "data", "historical_lifespans.json")
HISTORICAL_LIFESPANS = {}
if os.path.exists(HISTORICAL_LIFESPANS_PATH):
    try:
        with open(HISTORICAL_LIFESPANS_PATH, "r", encoding="utf-8") as f:
            HISTORICAL_LIFESPANS = json.load(f)
        print(f"[INFO] 역사 메타데이터 로드 완료: {len(HISTORICAL_LIFESPANS)}명")
    except Exception as e:
        print(f"[WARNING] 역사 메타데이터 로드 실패: {e}")
else:
    print(f"[WARNING] 역사 메타데이터 파일 없음: {HISTORICAL_LIFESPANS_PATH}")

# --- Helper functions ---
def get_associated_stories_for_char(df_clean: pd.DataFrame, character_name: str, max_stories: int = 50) -> List[Dict[str, Any]]:
    """
    CSV에서 특정 인물과 관련성이 높은 이야기(스토리) 목록을 추출하여
    프론트엔드 렌더링에 적합한 메타데이터 구조로 가공.
    """
    char_rows = df_clean[df_clean["relate_prsn_nm"].astype(str).str.contains(character_name)].copy()
    char_rows = char_rows.drop_duplicates(subset=["data_title_nm"]).head(max_stories)
    
    stories = []
    for _, row in char_rows.iterrows():
        domain = str(row["data_manage_keyword"]).strip()
        no = int(row["data_manage_no"])
        
        stories.append({
            "id": no,
            "domain": domain,
            "title": row["data_title_nm"],
            "summary": row["sumry_cn"] if pd.notna(row["sumry_cn"]) else "",
            "sido": row["ctprvn_nm"] if pd.notna(row["ctprvn_nm"]) else "",
            "sigungu": row["signgu_nm"] if pd.notna(row["signgu_nm"]) else ""
        })
    return stories

def initialize_historical_lifespans_file(selected_characters: List[str]) -> Dict[str, Any]:
    """
    선택된 캐릭터 중 historical_lifespans.json에 누락된 인물이 있다면
    OpenAI GPT-4o를 호출하여 자동으로 생몰년도 및 시대 정보를 생성하여 추가.
    """
    existing_lifespans = {}
    if os.path.exists(HISTORICAL_LIFESPANS_PATH):
        try:
            with open(HISTORICAL_LIFESPANS_PATH, "r", encoding="utf-8") as f:
                existing_lifespans = json.load(f)
        except Exception as e:
            print(f"[WARNING] 기존 historical_lifespans.json 로드 실패: {e}")
            
    missing_chars = [char for char in selected_characters if char not in existing_lifespans]
    if not missing_chars:
        return existing_lifespans
        
    print(f"[INFO] 다음 캐릭터들의 역사 메타데이터(생몰년도/시대)가 누락되었습니다: {missing_chars}")
    if not openai_client:
        print("[WARNING] OpenAI API 클라이언트가 없어 메타데이터 자동 생성을 할 수 없습니다.")
        return existing_lifespans
        
    print(f"[INFO] GPT-4o를 이용해 자동으로 메타데이터를 검색/생성합니다...")
    
    prompt = f"""
다음은 한국 역사 속 주요 인물들의 이름입니다: {missing_chars}
이 인물들의 정확한 실제 생몰년도(또는 활동 기간), 역사적 시대 명칭, 시대 태그를 조사하여 아래 JSON 형식으로 반환해 주세요.

[출력 형식]
{{
    "인물명1": {{
        "years": "생몰년도 또는 활동 기간 (예: 1852-1919, 1545-1598)",
        "era": "시대 명칭 (예: 조선 후기~대한제국, 조선 시대, 일제강점기, 근현대)",
        "era_tag": "시대 태그 (예: 조선 후기, 조선 시대, 일제강점기, 근현대)"
    }},
    ...
}}

* 주의사항:
1. 생몰년도는 실제 역사적 팩트에 맞게 'YYYY-YYYY' 형식으로 정확히 기록하세요 (예: 송만갑은 1866-1939).
2. 시대 태그(era_tag)는 ['조선 시대', '조선 후기', '일제강점기', '근현대', '고려 시대'] 중 하나와 매칭되도록 합리적으로 설정해 주세요.
"""
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        new_lifespans = json.loads(response.choices[0].message.content)
        
        # Merge new lifespans
        for char, info in new_lifespans.items():
            if char in missing_chars:
                existing_lifespans[char] = info
                print(f" ➔ '{char}' 메타데이터 자동 생성 완료: {info}")
                
        # Save updated lifespans back to file
        os.makedirs(os.path.dirname(HISTORICAL_LIFESPANS_PATH), exist_ok=True)
        with open(HISTORICAL_LIFESPANS_PATH, "w", encoding="utf-8") as f:
            json.dump(existing_lifespans, f, ensure_ascii=False, indent=4)
        print(f"[SUCCESS] {HISTORICAL_LIFESPANS_PATH} 파일 자동 갱신 완료!")
        
    except Exception as e:
        print(f"[ERROR] 역사 메타데이터 자동 생성 실패: {e}")
        
    return existing_lifespans

# --- OpenAI GPT Generators ---
def generate_character_profile_via_openai(character_name: str, stories: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    OpenAI GPT-4o 모델을 사용하여 캐릭터의 역사적 행적 RAG 컨텍스트를 분석하고,
    게임 플레이를 위한 카테고리, MBTI와 캐릭터 스탯 등 상세 정보를 JSON 형식으로 생성.
    """
    if not openai_client:
        raise ValueError("OpenAI API 클라이언트가 존재하지 않아 생성을 진행할 수 없습니다.")
        
    context_str = ""
    for i, s in enumerate(stories[:15]):
        context_str += f"[스토리 {i+1}] 제목: {s['title']}, 요약: {s['summary']}\n\n"

    lifespan_info = HISTORICAL_LIFESPANS.get(character_name, {})
    lifespan_str = lifespan_info.get("years", "알 수 없음")
    era_str = lifespan_info.get("era", "알 수 없음")
    era_tag_str = lifespan_info.get("era_tag", "알 수 없음")

    prompt = f"""너는 역사 선택형 시뮬레이션 게임 'K-Heroes'의 인물 카드 설계자야.
제공된 RAG 백그라운드 지식을 기반으로 대상 인물에 대한 정보를 추출하여 재미있으면서도 고증에 충실한 인물 카드 데이터로 생성해 줘.
어려운 한자어는 피하고 초등학생도 쉽게 읽을 수 있는 단어를 써줘.
모든 출력 텍스트는 반드시 한국어로만 작성하십시오. 힌디어·아랍어·태국어 등 다른 언어를 절대 삽입하지 마십시오.

[대상 인물 및 정확한 역사 정보]
이름: {character_name}
정확한 생몰년도(years): {lifespan_str}
정확한 시대 명칭(era): {era_str}
정확한 시대 태그(era_tag): {era_tag_str}

*중요: 위 [대상 인물 및 정확한 역사 정보]에 명시된 생몰년도({lifespan_str}), 시대 명칭({era_str}), 시대 태그({era_tag_str})를 최종 JSON의 'years', 'era', 'era_tag' 필드값으로 "반드시 토씨 하나 틀리지 않고 그대로" 기입하십시오. 절대 다른 연도나 시대 명칭을 임의로 추정하여 쓰지 마십시오.

[RAG 데이터 컨텍스트]
{context_str}

[캐릭터 분류 카테고리 판별 원칙]
RAG 데이터 컨텍스트에 담긴 인물의 주된 업적과 행적을 분석하여 다음 4가지 테마 중 하나를 엄격히 부여하세요:
- 정치 / 외교: 왕, 대통령, 재상, 정치가로서 국가 제도 개혁, 외교 협상, 권력 투쟁 등을 주로 펼친 경우.
- 독립 / 호국: 국난 극복, 외세 방어, 의병 활동, 독립운동, 군사적 전투 등을 주로 이끈 장군, 의사, 열사 등.
- 예술 / 문학: 판소리, 무용, 미술, 시, 소설, 음악 등 문화예술 창작 활동과 대중화에 헌신한 예인, 작가, 화가 등.
- 사상 / 학문: 성리학, 실학, 과학 기술 연구 및 사상적 깊이를 바탕으로 학술 교육에 헌신한 학자, 사상가 등. (주의: 조선 전기~중기의 성리학자를 '실학'으로 분류하지 않도록 엄격히 구분할 것)

[★ 역사 왜곡 방지 및 인물별 필수 고증 규칙 (MUST FOLLOW) ★]
1. 주어(Subject) 검증: 인물이 '재임 혹은 생존했던 시기'에 일어난 사건이라고 해서 모두 그 인물의 업적이 아닙니다. (예: 고종 재임기 경복궁 재건의 실제 주도자는 흥선대원군임). RAG 컨텍스트를 치밀하게 읽고, 타인이나 선대가 주도한 업적을 대상 인물이 직접 한 것처럼 서술하는 오류를 절대 범하지 마십시오.
2. 마지막 지위 검증: 역사적 지위나 호칭을 명확히 하십시오. (예: 조선의 마지막 왕은 순종이며, 고종은 대한제국의 황제임). '마지막 왕', '최초의 인물' 같은 절대적 수식어를 쓸 때는 역사적 정설과 일치하는지 재차 확인하십시오.
3. 과오의 솔직한 기술 및 감정적 미화 금지: 실책, 패배, 외교적 무능, 친일 변절 등 부정적 행적은 '환경 탓', '어쩔 수 없는 선택', '비극적 고뇌'로 포장하지 마십시오. 미화하는 순간 고증 실패입니다. 단어 선택 시 '타협적', '유연한' 같은 긍정적 뉘앙스의 단어로 변명해주지 말고, '실패했다', '무력했다', '배반했다' 등 객관적 팩트를 서술하십시오.
4. MBTI의 부정적 기능 서술: MBTI 4개 필드(E/I, S/N, T/F, J/P)를 서술할 때, 인물의 실책이나 한계가 해당 성향의 '부정적 발현' 때문이었음을 솔직하게 적으십시오. (예: 우유부단하여 대처가 미흡했다면 P성향의 부작용으로, 감정에 치우쳐 실리 외교에 실패했다면 F성향의 한계로 솔직하게 기술)
5. 범용 역사 고증 및 왜곡 방지 규칙 (모든 인물에 공통 적용):
     * 모든 서술(연도, 인명, 사건명, 단체명, 수치 등)의 근거는 반드시 제공된 RAG 컨텍스트(kf_area_total_merged.csv 데이터 및 교과서 정보)에 있는 내용이어야 합니다. RAG 컨텍스트에 없는 사실을 임의로 생성(hallucination)하지 마십시오.
     * 연도, 인명, 단체명 등 한 건 한 건의 고유명사는 RAG 컨텍스트에서 직접 확인된 경우에만 사용하십시오. 확인되지 않으면 구체적 표현을 피하고 일반적으로 서술하십시오.
     * 인물이 생존한 시대에 일어난 사건이라도, 그 인물이 실제 이끌거나 주도한 사항이 아닌 경우 그 인물의 업적이나 결정으로 서술하지 마십시오. 해당 시기 동일하게 활동한 타인의 업적이 주인공에게 귀속되지 않도록 RAG 컨텍스트를 치밀하게 분석하십시오.
     * 실책, 패배, 굴복, 친일 변절, 학살, 독재 등 도덕적으로 부정적이거나 역사적으로 비판받는 행적을 '환경 탓', '어쩔 수 없는 선택', '비극적 고뇌나 슬픔', '내적 갈등'으로 미화하거나 합리화하지 마십시오.
     * 부정적 행적은 변명 없이 객관적이고 중립적인 팩트로 직접 명시하십시오. '실패했다', '무력했다', '항복했다', '배반했다', '학살에 책임이 있다' 등 사실적 단어를 직접 사용하여 기록하고, 면죄부를 주지 마십시오.
     * 인물의 실제 생몰년도({lifespan_str}) 범위를 벗어나는 연도를 절대 사용하지 마십시오. 사망 이후의 사건을 주인공이 직접 공헌한 것처럼 서술하는 등 시대적 정합성에 위배되는 날조를 금지합니다.
     * RAG에 정확한 연도가 확인되지 않으면 임의로 연도를 지정하여 기입하지 말고 '대략적인 연대(예: 16세기 중반, 1890년대)'로 표현하십시오.
     * 인물이 살았던 당대에 존재하지 않는 기관, 제도, 어휘, 개념을 주인공에게 부여하지 마십시오. (예: 조선시대 인물에게 근대 서양 철학이나 자유민주주의, 무신론 개념 투영 금지, 조선 전기에 실학 개념 투영 금지)
     * 조선 시대 배경에서는 '출판', '대중 유통' 같은 현대식 단어 대신 '필사본 유통', '목판본 간행' 등 시대에 맞는 어휘를 사용하십시오.
     * 교과서 및 역사학계에서 공식 검증되지 않은 비공식/대중적 수식어(예: '세계 4대 해전 중 하나', '한반도의 실질적 지배자' 등)를 절대 사용하지 마십시오. '마지막 왕', '최초의 인물' 같은 절대적 수식어는 역사적 정설과 일치하는지 RAG 컨텍스트로 재확인한 후에만 사용하십시오.

* [중요] 스탯 설계 규칙:
  - 'stats' 배열에는 반드시 해당 인물의 일생과 업적, 혹은 과오를 가장 잘 대변하는 구체적이고 유니크한 능력치 이름 3가지를 정의하십시오. ('예술성', '성공 확률', '국력' 같은 범용적이고 추상적인 단어 금지)
  - 인물의 고유성을 담아야 합니다.

반드시 아래 JSON 형식으로만 출력해:
{{
    "name": "인물 이름",
    "category": "RAG 컨텍스트를 분석하여 부여한 카테고리. 반드시 다음 4가지 문자열 중 하나여야 함: ['정치 / 외교', '독립 / 호국', '예술 / 문학', '사상 / 학문']",
    "era": "시대 명칭",
    "era_tag": "시대 태그",
    "role": "대표 직업/역할 (예: 왕, 독립운동가, 성리학자, 변절자, 명창)",
    "keywords": ["대표 해시태그 1", "태그 2", "태그 3"],
    "years": "생몰년도 또는 활동 기간",
    "situation": "당시 시대 상황 설명 (초등학생도 이해할 수 있게 쉽게 2~3줄)",
    "one_line_summary": "인물의 빛과 그림자, 혹은 특징을 직관적으로 담은 수식어 한줄 요약 (미화적 수식어 절대 금지)",
    "mbti": "RAG 분석을 통해 인물의 역사적 행적을 가장 잘 설명하는 MBTI 4글자 (대문자 필수)",
    "mbti_nickname": "부여한 MBTI에 따른 캐릭터 별명 (과오나 한계가 있는 인물은 그것이 드러나는 별명 부여)",
    "mbti_details": {{
        "E_I": "반드시 '외향형(E) 성향은...' 또는 '내향형(I) 성향은...'으로 시작하여, 해당 성향이 역사 속 행동(성공 혹은 한계/과오)에서 어떻게 나타났는지 객관적 서술",
        "S_N": "반드시 '감각형(S) 성향은...' 또는 '직관형(N) 성향은...'으로 시작하여, 해당 성향이 역사 속 행동(성공 혹은 한계/과오)에서 어떻게 나타났는지 객관적 서술",
        "T_F": "반드시 '사고형(T) 성향은...' 또는 '감정형(F) 성향은...'으로 시작하여, 해당 성향이 역사 속 행동(성공 혹은 한계/과오)에서 어떻게 나타났는지 객관적 서술",
        "J_P": "반드시 '판단형(J) 성향은...' 또는 '인식형(P) 성향은...'으로 시작하여, 해당 성향이 역사 속 행동(성공 혹은 한계/과오)에서 어떻게 나타났는지 객관적 서술"
    }},
    "stats": [
        {{"name": "스탯 1 이름 (예: 학문적 깊이, 전술력, 개혁 추진력 등)", "value": 88, "desc": "해당 능력치에 대한 역사적 사실 기반 설명"}},
        {{"name": "스탯 2 이름", "value": 90, "desc": "설명"}},
        {{"name": "스탯 3 이름", "value": 85, "desc": "설명"}}
    ],
    "intro_quote": "인물의 실제 명언, 또는 인물의 역사적 행보(긍정/부정 불문)를 가장 잘 대변하는 다짐이나 말 한 줄",
    "intro_desc": "인물이 역사적 무대에 등장한 계기와 실제 행적에 대한 객관적인 설명 2~3줄 (타인의 업적을 훔쳐오지 말 것)"
}}
"""
    valid_mbtis = {"ISTJ", "ISFJ", "INFJ", "INTJ", "ISTP", "ISFP", "INFP", "INTP", "ESTP", "ESFP", "ENFP", "ENTP", "ESTJ", "ESFJ", "ENFJ", "ENTJ"}

    for retry in range(3):
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        try:
            profile_data = json.loads(response.choices[0].message.content)
            mbti_val = profile_data.get("mbti", "").upper().strip()
            if mbti_val in valid_mbtis:
                profile_data["mbti"] = mbti_val
                return profile_data
            else:
                print(f"[WARNING] Invalid MBTI generated ({mbti_val}) for {character_name}. Retrying profile generation...")
        except Exception as e:
            print(f"[WARNING] Failed to parse profile response: {e}. Retrying...")
            
    # Fallback to a standard MBTI if all retries fail
    profile_data["mbti"] = "INFP"
    return profile_data


def generate_scenario_themes(character_name: str, stories: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not openai_client:
        raise ValueError("OpenAI API 클라이언트가 존재하지 않아 시나리오 테마 생성을 할 수 없습니다.")

    context_str = ""
    for i, s in enumerate(stories[:50]):  # 최대 50개의 RAG 스토리 전달
        context_str += f"[스토리 ID: {s['id']}] 제목: {s['title']}, 요약: {s['summary']}\n\n"

    lifespan_info = HISTORICAL_LIFESPANS.get(character_name, {})
    lifespan_str = lifespan_info.get("years", "알 수 없음")

    prompt = f"""너는 역사 선택형 시뮬레이션 게임 'K-Heroes'의 시나리오 기획자야.
제공된 역사 단서(RAG)를 바탕으로 대상 인물인 '{character_name}'에 대한 독립된 역사 테마 시나리오(챕터)를 최소 1개, 최대 2개 선정하여 설계해 줘.
주요 역사적 챕터나 갈등 국면이 명확히 구분되지 않는다면 1개만 설계해도 무방하며, 최대 2개까지만 설계하십시오.
각 시나리오의 핵심 메타데이터만 구성하고, 턴(turns) 정보는 절대 포함하지 마십시오.
어려운 한자어는 피하고 초등학생도 쉽게 읽을 수 있는 단어를 써줘.
모든 출력 텍스트는 반드시 한국어로만 작성하십시오. 힌디어·아랍어·태국어 등 다른 언어를 절대 삽입하지 마십시오.

[대상 인물 및 역사적 타임라인 제약]
이름: {character_name}
실제 생몰년도 (활동 연대): {lifespan_str}

[역사 자료 (RAG 스토리가 인물별로 분류되어 있음)]
{context_str}

[시나리오 선정 및 구성 원칙]
반드시 다음 기준에 따라 1~2개(최대 2개)의 시나리오를 선정 및 설계하십시오:

1. **철저한 주어 중심 서술 (Actor-Centric Rule)**
   - 시나리오의 제목과 설명에서 **반드시 대상 인물({character_name})이 '직접' 판단하고 행동한 사건**만 다루십시오. 
   - 대상 인물이 주도하지 않고 구경만 했거나, 다른 인물(예: 흥선대원군, 신하 등)이 주도한 사건을 대상 인물의 제목으로 삼아 주인공처럼 포장해서는 안 됩니다.
2. **역사적 사실 기반 및 미화 배제 (Strict Fact-Based)**
   - 오직 제공된 [역사 자료 (RAG)]와 실제 역사적 정설에만 기반하여 작성하십시오.
   - 인물의 실책, 패배, 우유부단함, 변절이 주요 역사적 사실이라면 시나리오 역시 그 '실패와 한계의 순간'을 있는 그대로 다루어야 합니다. 이를 '성장을 위한 아픔'이나 '위대한 도전' 같은 감정적 미화 단어로 포장하지 마십시오.
3. **스토리 병합 및 종합 (Story Merging & Grouping)**
   - 제공된 역사 자료 중 개별적으로 흩어져 있는 연관 스토리들을 유기적으로 병합(Merge)하여 하나의 풍부한 시나리오 테마로 합치십시오.
4. **진정한 역사적 딜레마 반영**
   - 인물이 처했던 실제 갈등을 다루되, 인물의 한계(우유부단함, 무력함 등)가 팩트라면 그 한계 때문에 결정을 내리지 못하고 무너졌던 정황 자체를 시나리오 설명과 팩트에 사실적으로 반영하십시오.
5. **범용 역사 고증 및 왜곡 방지 규칙 (MUST FOLLOW)**:
    - 모든 서술(연도, 인명, 사건명, 단체명, 수치 등)의 근거는 반드시 제공된 RAG 컨텍스트(kf_area_total_merged.csv 데이터 및 교과서 정보)에 있는 내용이어야 합니다. RAG 컨텍스트에 없는 사실을 임의로 생성(hallucination)하지 마십시오.
    - 연도, 인명, 단체명 등 한 건 한 건의 고유명사는 RAG 컨텍스트에서 직접 확인된 경우에만 사용하십시오. 확인되지 않으면 구체적 표현을 피하고 일반적으로 서술하십시오.
    - 인물이 생존한 시대에 일어난 사건이라도, 그 인물이 실제 이끌거나 주도한 사항이 아닌 경우 그 인물의 업적이나 결정으로 서술하지 마십시오. 해당 시기 동일하게 활동한 타인의 업적이 주인공에게 귀속되지 않도록 RAG 컨텍스트를 치밀하게 분석하십시오.
    - 실책, 패배, 굴복, 친일 변절, 학살, 독재 등 도덕적으로 부정적이거나 역사적으로 비판받는 행적을 '환경 탓', '어쩔 수 없는 선택', '비극적 고뇌나 슬픔', '내적 갈등'으로 미화하거나 합리화하지 마십시오.
    - 부정적 행적은 변명 없이 객관적이고 중립적인 팩트로 직접 명시하십시오. '실패했다', '무력했다', '항복했다', '배반했다', '학살에 책임이 있다' 등 사실적 단어를 직접 사용하여 기록하고, 면죄부를 주지 마십시오.
    - 인물의 실제 생몰년도 ({lifespan_str}) 범위를 벗어나는 연도를 절대 사용하지 마십시오. 사망 이후의 사건을 주인공이 직접 공헌한 것처럼 서술하는 등 시대적 정합성에 위배되는 날조를 금지합니다.
    - RAG에 정확한 연도가 확인되지 않으면 임의로 연도를 지정하여 기입하지 말고 '대략적인 연대(예: 16세기 중반, 1890년대)'로 표현하십시오.
    - 인물이 살았던 당대에 존재하지 않는 기관, 제도, 어휘, 개념을 주인공에게 부여하지 마십시오. (예: 조선시대 인물에게 근대 서양 철학이나 자유민주주의, 무신론 개념 투영 금지, 조선 전기에 실학 개념 투영 금지)
    - 조선 시대 배경에서는 '출판', '대중 유통' 같은 현대식 단어 대신 '필사본 유통', '목판본 간행' 등 시대에 맞는 어휘를 사용하십시오.
    - 교과서 및 역사학계에서 공식 검증되지 않은 비공식/대중적 수식어(예: '세계 4대 해전 중 하나', '한반도의 실질적 지배자' 등)를 절대 사용하지 마십시오. '마지막 왕', '최초의 인물' 같은 절대적 수식어는 역사적 정설과 일치하는지 RAG 컨텍스트로 재확인한 후에만 사용하십시오.
6. **시나리오별 명확한 시간선(Era/Years) 확정 규칙**
   - 각 시나리오의 'description'이나 'historical_facts' 내부에 이 테마가 실제 역사 속에서 전개된 '시작 연도'와 '종료 연도'를 명확히 명시하십시오. 
   - 인물의 생몰년도를 벗어나는 연도는 절대 사용할 수 없으며, 인물이 사망한 이후의 사후 평가나 유산 전파 서사는 인물이 살아있을 때의 최종 결단(예: 유작 아카이빙, 사신과의 교류 등)과 연결하여 인물의 생존 시점 안에서 서사적 맺음표를 찍어야 합니다.

반드시 아래 JSON 형식으로만 출력해:
{{
   "scenarios": [
        {{
            "scenario_id": 1,
            "title": "시나리오 대주제 (주의: 반드시 대상 인물이 '직접 주도하거나 직면한' 사건 명칭이어야 함)",
            "description": "이 시나리오가 어떤 국면인지 대상 인물의 역량과 한계를 포함하여 초등학생도 이해할 수 있게 설명 2~3줄",
            "historical_facts": "RAG에서 발췌한 이 시나리오의 핵심 실제 역사적 팩트 2~3줄 (수식어나 인물에 대한 감정적 옹호/변명 배제, 실제 주도자가 누구인지 명확히 기록)",
            "source_story_ids": [102, 105]
        }},
        {{
            "scenario_id": 2,
            "title": "시나리오 대주제",
            "description": "설명 2~3줄",
            "historical_facts": "실제 역사적 팩트 2~3줄",
            "source_story_ids": [106]
        }}
    ]
}}
"""
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "user", "content": prompt}
        ],
        response_format={"type": "json_object"}
    )
    
    data = json.loads(response.choices[0].message.content)
    return data.get("scenarios", [])


def get_stats_keys_and_format(category: str):
    # Determine stats keys
    if category == "독립 / 호국":
        stats_keys = ["전투력", "팀워크", "성공 확률"]
    elif category == "정치 / 외교":
        stats_keys = ["국력", "백성의 지지", "성공 확률"]
    elif category == "예술 / 문학":
        stats_keys = ["예술성", "백성의 위로", "성공 확률"]
    elif category == "사상 / 학문":
        stats_keys = ["학문적 깊이", "실용성", "성공 확률"]
    else:
        stats_keys = ["스탯1", "스탯2", "성공 확률"]

    stats_format = "{" + ", ".join([f'"{k}": 정수' for k in stats_keys]) + "}"
    return stats_keys, stats_format


def get_history_rag_context(character_name: str, scenario_title: str) -> str:
    """국사 교과서 인메모리 RAG로부터 해당 시나리오 관련 팩트를 조회하여 컨텍스트 텍스트로 구성."""
    try:
        db_pkl_path = os.path.join(BASE_DIR, "data", "processed", "history_db.pkl")
        rag_instance = get_rag_instance(db_path=db_pkl_path)
        query = f"{character_name} {scenario_title}"
        
        # HISTORICAL_LIFESPANS에서 era_tag 조회
        era_tag = HISTORICAL_LIFESPANS.get(character_name, {}).get("era_tag", "")
        
        history_rag_results = rag_instance.retrieve(
            query, 
            top_k=3, 
            similarity_threshold=0.18,
            character_name=character_name,
            era_tag=era_tag
        )
        if not history_rag_results:
            # Fallback to searching with character name only if scenario search yields no results
            history_rag_results = rag_instance.retrieve(
                character_name, 
                top_k=3, 
                similarity_threshold=0.18,
                character_name=character_name,
                era_tag=era_tag
            )
        if history_rag_results:
            context_str = "\n[국사교과서 관련 추가 고증 자료]\n"
            for r in history_rag_results:
                context_str += f"- {r['chunk']}\n"
            return context_str
    except Exception as e:
        pass
    return ""


def generate_turn1_for_scenario(character_name: str, scenario_title: str, scenario_description: str, historical_facts: str, category: str) -> Dict[str, Any]:
    if not openai_client:
        raise ValueError("OpenAI API 클라이언트가 존재하지 않아 턴 생성을 할 수 없습니다.")

    lifespan_info = HISTORICAL_LIFESPANS.get(character_name, {})
    lifespan_str = lifespan_info.get("years", "알 수 없음")
    stats_keys, stats_format = get_stats_keys_and_format(category)
    history_context = get_history_rag_context(character_name, scenario_title)

    prompt = f"""너는 역사 선택형 시뮬레이션 게임 'K-Heroes'의 턴 설계자야.
대상 인물인 '{character_name}'의 시나리오 '{scenario_title}'에 속한 첫 번째 턴(sort_order: 0)을 설계해 줘.
어려운 한자어(예: 친정, 하야, 간행 등)는 초등학생도 쉽게 이해할 수 있는 쉬운 단어로 풀어서 써줘.
모든 출력 텍스트는 반드시 한국어로만 작성하십시오. 힌디어·아랍어·태국어 등 다른 언어를 절대 삽입하지 마십시오.

[대상 인물 및 역사적 타임라인 제약]
이름: {character_name}
실제 생몰년도 (활동 연대): {lifespan_str}

[시나리오 컨텍스트]
시나리오 제목: {scenario_title}
시나리오 설명: {scenario_description}
시나리오 핵심 역사적 팩트: {historical_facts}{history_context}

[설계 원칙]
1. 턴 흐름의 연속성 (보틀넥 수렴 구조):
   - 본 게임은 1턴의 선택 결과에 상관없이 다음 턴으로 상황이 이어지는 병합형 구조(Converging Choice)입니다.
   - 비역사적 선택지 'B'를 고르더라도 그 결과가 '이야기가 완전히 망했거나 주인공이 잊혔다'며 극단적으로 끝나버리게 하지 마십시오.
   - 1턴의 'B' 결과 텍스트('result_text')는 과정 중심/전환 중심의 중간 지문이어야 합니다. 예: "온건한 방향을 선택하자 다소 평이해졌으나, 다른 흥미로운 사건을 구상하게 된다" 등으로 표현하여, 다음 턴의 상황(situation)과 논리적으로 모순되지 않도록 매끄럽게 연결해 주어야 합니다.
2. 선택지 작명과 결과 뉘앙스:
   - 선택지 제목은 품위 있고 플레이어가 고르고 싶게 작성해.
   - 역사적 선택지 'A'는 역사적 팩트(is_historical: true)에 기반하고, 대체역사 선택지 'B'는 설득력 있는 대체역사(is_historical: false)여야 해.
3. 역사적 시대상 및 타임라인 준수:
   - 연도 기입 시, 반드시 {character_name}의 활동 연도인 {lifespan_str} 범위 내로만 설정하십시오. (배경이 되는 건물의 건립 연도 등 고증을 철저히 확인할 것)
   - 조선 시대 배경일 때 '출판', '대중 유통' 등의 현대식 단어 대신 '필사본(손으로 베껴 쓴 책) 유통', '목판본(나무판에 새겨 찍은 책) 간행' 같은 단어를 사용하십시오.
4. 주인공 중심: {character_name}가 주어가 되어 고민하고 선택하는 상황으로만 설계하십시오.
5. 게임 턴 스탯(stats) 규칙 (★최우선 순위 사안):
   - 선택지 A와 B의 'stats' 내부에 들어갈 3가지 키값은 인물 카드의 스탯과 무관하게, 반드시 다음의 게임 고정 스탯 3가지("{stats_keys}")만 사용해야 합니다.
   - 프롬프트에 임의로 정의된 다른 범용 키값은 예시일 뿐이므로 이를 절대로 출력하지 마십시오. 오직 위에서 제시한 3개의 고정 스탯 키만 사용하여 수치를 연산하십시오.
   - 수치 변동은 10~30 범위 내외의 정수(예: 15, -10 등)로 설정해 주십시오.
6. 이모티콘 금지: 모든 출력 텍스트(tip_title 포함)에 이모티콘이나 이모지(예: 💡, ⚠️)를 절대 포함하지 마십시오.
7. 범용 역사 고증 및 왜곡 방지 규칙 (모든 인물에 공통 적용):
   - 모든 서술(연도, 인명, 사건명, 단체명, 수치 등)의 근거는 반드시 제공된 RAG 컨텍스트(kf_area_total_merged.csv 데이터 및 교과서 정보)에 있는 내용이어야 합니다. RAG 컨텍스트에 없는 사실을 임의로 생성(hallucination)하지 마십시오.
   - 연도, 인명, 단체명 등 한 건 한 건의 고유명사는 RAG 컨텍스트에서 직접 확인된 경우에만 사용하십시오. 확인되지 않으면 구체적 표현을 피하고 일반적으로 서술하십시오.
   - 인물이 생존한 시대에 일어난 사건이라도, 그 인물이 실제 이끌거나 주도한 사항이 아닌 경우 그 인물의 업적이나 결정으로 서술하지 마십시오. 해당 시기 동일하게 활동한 타인의 업적이 주인공에게 귀속되지 않도록 RAG 컨텍스트를 치밀하게 분석하십시오.
   - 실책, 패배, 굴복, 친일 변절, 학살, 독재 등 도덕적으로 부정적이거나 역사적으로 비판받는 행적을 '환경 탓', '어쩔 수 없는 선택', '비극적 고뇌나 슬픔', '내적 갈등'으로 미화하거나 합리화하지 마십시오.
   - 부정적 행적은 변명 없이 객관적이고 중립적인 팩트로 직접 명시하십시오. '실패했다', '무력했다', '항복했다', '배반했다', '학살에 책임이 있다' 등 사실적 단어를 직접 사용하여 기록하고, 면죄부를 주지 마십시오.
   - 인물의 실제 생몰년도 ({lifespan_str}) 범위를 벗어나는 연도를 절대 사용하지 마십시오. 사망 이후의 사건을 주인공이 직접 공헌한 것처럼 서술하는 등 시대적 정합성에 위배되는 날조를 금지합니다.
   - RAG에 정확한 연도가 확인되지 않으면 임의로 연도를 지정하여 기입하지 말고 '대략적인 연대(예: 16세기 중반, 1890년대)'로 표현하십시오.
   - 인물이 살았던 당대에 존재하지 않는 기관, 제도, 어휘, 개념을 주인공에게 부여하지 마십시오. (예: 조선시대 인물에게 근대 서양 철학이나 자유민주주의, 무신론 개념 투영 금지, 조선 전기에 실학 개념 투영 금지)
   - 조선 시대 배경에서는 '출판', '대중 유통' 같은 현대식 단어 대신 '필사본 유통', '목판본 간행' 같은 단어를 사용하십시오.
   - 교과서 및 역사학계에서 공식 검증되지 않은 비공식/대중적 수식어(예: '세계 4대 해전 중 하나', '한반도의 실질적 지배자' 등)를 절대 사용하지 마십시오. '마지막 왕', '최초의 인물' 같은 절대적 수식어는 역사적 정설과 일치하는지 RAG 컨텍스트로 재확인한 후에만 사용하십시오.
8. 대체역사 선택지 'B'의 개연성 및 구체성 규칙 (안전한 보틀넥 구조):
   - 선택지 B는 "전통을 버리고 현대 춤을 추다", "강연회를 열다"와 같은 현대식 마케팅이나 뜬구름 잡는 추상적 행동으로 설계하면 게이미피케이션의 몰입도가 깨집니다.
   - 당대 역사적 정국(예: 조선 사대부들의 방해, 일제의 사상 검열, 유교 가문의 통제, 서양 음악 반주 채택 등)에서 주인공이 충분히 고민했을 법한 '부정적 타협안'이나 '다른 방식의 현실적 대안'을 선택지 B의 제목과 설명으로 구체화하십시오.
   - 플레이어가 B를 선택하더라도 주인공이 사망하거나 세계관이 파괴되어 다음 턴으로 진행하지 못하는 극단적 결과를 내서는 안 됩니다. "일시적으로 기득권의 압박은 피했으나 본질을 잃어버려 다음 돌파구를 고민하게 된다"처럼, 과정의 변주를 주되 다음 턴의 정역사 상황(situation)으로 매끄럽게 수렴할 수 있는 '연속성 있는 중간 지문'으로 result_text를 작성하십시오.
9. 턴 간 시간선 전후 관계 일치 규칙:
   - 1턴(sort_order: 0) -> 2턴(sort_order: 1) -> 3턴(sort_order: 2)으로 진행됨에 따라, 각 턴 제목에 명시되는 연도(Year)는 반드시 '순차적 시간 흐름(크로놀로지)'을 따라야 합니다.
   - 앞선 턴보다 과거의 연도가 뒷 턴에 등장하거나, 인물의 생몰년도를 이탈하는 연도 할루시네이션을 절대 금지합니다.

반드시 마크다운 등 다른 텍스트 없이 아래 JSON 형식으로만 출력해:
{{
    "sort_order": 0,
    "title": "1턴 사건 명칭과 연도 (예: 무기 선택 (1932년 4월))",
    "situation": "상황 묘사 2~3줄 (시나리오 도입부를 바탕으로 주인공이 맞닥뜨린 첫 갈등 상황을 매끄럽게 서술)",
    "tip_title": "질문 형식의 토글 질문 (해당 역사 사실에 관한 흥미로운 질문)",
    "tip_desc": "질문에 대한 정확하고 자세한 실제 역사적 해설 2~3줄",
    "choices": {{
        "A": {{
            "title": "선택지 A 제목",
            "description": "선택지 A 상세 행동 설명 1줄",
            "stats": {stats_format},
            "result_text": "이 선택을 한 후 보여줄 결과 지문 1~2줄",
            "is_historical": true
        }},
        "B": {{
            "title": "선택지 B 제목",
            "description": "선택지 B 상세 행동 설명 1줄",
            "stats": {stats_format},
            "result_text": "이 선택을 한 후 보여줄 결과 지문 1~2줄",
            "is_historical": false
        }}
    }}
}}"""
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "user", "content": prompt}
        ],
        response_format={"type": "json_object"}
    )
    
    data = json.loads(response.choices[0].message.content)
    return data


def generate_turn2_for_scenario(character_name: str, scenario_title: str, scenario_description: str, historical_facts: str, category: str, turn1_data: Dict[str, Any]) -> Dict[str, Any]:
    if not openai_client:
        raise ValueError("OpenAI API 클라이언트가 존재하지 않아 턴 생성을 할 수 없습니다.")

    lifespan_info = HISTORICAL_LIFESPANS.get(character_name, {})
    lifespan_str = lifespan_info.get("years", "알 수 없음")
    stats_keys, stats_format = get_stats_keys_and_format(category)

    turn1_str = json.dumps(turn1_data, ensure_ascii=False, indent=2)
    history_context = get_history_rag_context(character_name, scenario_title)

    prompt = f"""너는 역사 선택형 시뮬레이션 게임 'K-Heroes'의 턴 설계자야.
대상 인물인 '{character_name}'의 시나리오 '{scenario_title}'에 속한 두 번째 턴(sort_order: 1)을 설계해 줘.
이전 턴(1턴)의 상황 및 각 선택 결과 정보를 분석하여, 사건이 개연성 있고 흥미진진하게 이어지도록 구성하십시오.
어려운 한자어는 피하고 초등학생도 쉽게 읽을 수 있는 단어를 써줘.
모든 출력 텍스트는 반드시 한국어로만 작성하십시오. 힌디어·아랍어·태국어 등 다른 언어를 절대 삽입하지 마십시오.

[대상 인물 및 역사적 타임라인 제약]
이름: {character_name}
실제 생몰년도 (활동 연대): {lifespan_str}

[시나리오 컨텍스트]
시나리오 제목: {scenario_title}
시나리오 설명: {scenario_description}
시나리오 핵심 역사적 팩트: {historical_facts}{history_context}

[이전 1턴 데이터]
{turn1_str}

[설계 원칙]
1. 턴 흐름의 연속성 (보틀넥 수렴 구조):
   - 본 게임은 1턴의 선택 결과에 상관없이 2턴의 상황(situation)으로 이어지는 구조입니다.
   - 플레이어가 1턴에서 역사적 선택 A를 고르든, 대체역사 선택 B를 고르든(각각의 result_text 참조) 자연스럽게 받아들일 수 있는 2턴 상황(situation)을 묘사하십시오.
   - 비역사적 선택지 'B'를 고르더라도 그 결과가 '이야기가 완전히 망했거나 주인공이 잊혔다'며 극단적으로 끝나버리게 하지 마십시오.
   - 2턴의 'B' 결과 텍스트('result_text')는 과정 중심/전환 중심의 중간 지문이어야 합니다. 예: "온건한 방향을 선택하자 다소 평이해졌으나, 다른 흥미로운 사건을 구상하게 된다" 등으로 표현하여, 3턴의 최종 상황(situation)과 논리적으로 모순되지 않도록 매끄럽게 연결해 주어야 합니다.
2. 선택지 작명과 결과 뉘앙스:
   - 선택지 제목은 품위 있고 플레이어가 고르고 싶게 작성해.
   - 역사적 선택지 'A'는 역사적 팩트(is_historical: true)에 기반하고, 대체역사 선택지 'B'는 설득력 있는 대체역사(is_historical: false)여야 해.
3. 역사적 시대상 및 타임라인 준수:
   - 연도 기입 시, 반드시 {character_name}의 활동 연도인 {lifespan_str} 범위 내로 설정하며, 1턴의 연도와 전후 관계가 모순되지 않고 자연스럽게 이어지도록 하십시오.
   - 조선 시대 배경일 때 '출판', '대중 유통' 등의 현대식 단어 대신 '필사본 유통', '목판본 간행' 같은 단어를 사용하십시오.
4. 주인공 중심: {character_name}가 주어가 되어 고민하고 선택하는 상황으로만 설계하십시오.
5. 게임 턴 스탯(stats) 규칙 (★최우선 순위 사안):
   - 선택지 A와 B의 'stats' 내부에 들어갈 3가지 키값은 인물 카드의 스탯과 무관하게, 반드시 다음의 게임 고정 스탯 3가지("{stats_keys}")만 사용해야 합니다.
   - 프롬프트에 임의로 정의된 다른 범용 키값은 예시일 뿐이므로 이를 절대로 출력하지 마십시오. 오직 위에서 제시한 3개의 고정 스탯 키만 사용하여 수치를 연산하십시오.
   - 수치 변동은 10~30 범위 내외의 정수(예: 15, -10 등)로 설정해 주십시오.
6. 이모티콘 금지: 모든 출력 텍스트(tip_title 포함)에 이모티콘이나 이모지(예: 💡)를 절대 포함하지 마십시오.
7. 범용 역사 고증 및 왜곡 방지 규칙 (모든 인물에 공통 적용):
   - 모든 서술(연도, 인명, 사건명, 단체명, 수치 등)의 근거는 반드시 제공된 RAG 컨텍스트(kf_area_total_merged.csv 데이터 및 교과서 정보)에 있는 내용이어야 합니다. RAG 컨텍스트에 없는 사실을 임의로 생성(hallucination)하지 마십시오.
   - 연도, 인명, 단체명 등 한 건 한 건의 고유명사는 RAG 컨텍스트에서 직접 확인된 경우에만 사용하십시오. 확인되지 않으면 구체적 표현을 피하고 일반적으로 서술하십시오.
   - 인물이 생존한 시대에 일어난 사건이라도, 그 인물이 실제 이끌거나 주도한 사항이 아닌 경우 그 인물의 업적이나 결정으로 서술하지 마십시오. 해당 시기 동일하게 활동한 타인의 업적이 주인공에게 귀속되지 않도록 RAG 컨텍스트를 치밀하게 분석하십시오.
   - 실책, 패배, 굴복, 친일 변절, 학살, 독재 등 도덕적으로 부정적이거나 역사적으로 비판받는 행적을 '환경 탓', '어쩔 수 없는 선택', '비극적 고뇌나 슬픔', '내적 갈등'으로 미화하거나 합리화하지 마십시오.
   - 부정적 행적은 변명 없이 객관적이고 중립적인 팩트로 직접 명시하십시오. '실패했다', '무력했다', '항복했다', '배반했다', '학살에 책임이 있다' 등 사실적 단어를 직접 사용하여 기록하고, 면죄부를 주지 마십시오.
   - 인물의 실제 생몰년도 ({lifespan_str}) 범위를 벗어나는 연도를 절대 사용하지 마십시오. 사망 이후의 사건을 주인공이 직접 공헌한 것처럼 서술하는 등 시대적 정합성에 위배되는 날조를 금지합니다.
   - RAG에 정확한 연도가 확인되지 않으면 임의로 연도를 지정하여 기입하지 말고 '대략적인 연대(예: 16세기 중반, 1890년대)'로 표현하십시오.
   - 인물이 살았던 당대에 존재하지 않는 기관, 제도, 어휘, 개념을 주인공에게 부여하지 마십시오. (예: 조선시대 인물에게 근대 서양 철학이나 자유민주주의, 무신론 개념 투영 금지, 조선 전기에 실학 개념 투영 금지)
   - 조선 시대 배경에서는 '출판', '대중 유통' 같은 현대식 단어 대신 '필사본 유통', '목판본 간행' 같은 단어를 사용하십시오.
   - 교과서 및 역사학계에서 공식 검증되지 않은 비공식/대중적 수식어(예: '세계 4대 해전 중 하나', '한반도의 실질적 지배자' 등)를 절대 사용하지 마십시오. '마지막 왕', '최초의 인물' 같은 절대적 수식어는 역사적 정설과 일치하는지 RAG 컨텍스트로 재확인한 후에만 사용하십시오.
8. 대체역사 선택지 'B'의 개연성 및 구체성 규칙 (안전한 보틀넥 구조):
   - 선택지 B는 "전통을 버리고 현대 춤을 추다", "강연회를 열다"와 같은 현대식 마케팅이나 뜬구름 잡는 추상적 행동으로 설계하면 게이미피케이션의 몰입도가 깨집니다.
   - 당대 역사적 정국(예: 조선 사대부들의 방해, 일제의 사상 검열, 유교 가문의 통제, 서양 음악 반주 채택 등)에서 주인공이 충분히 고민했을 법한 '부정적 타협안'이나 '다른 방식의 현실적 대안'을 선택지 B의 제목과 설명으로 구체화하십시오.
   - 플레이어가 B를 선택하더라도 주인공이 사망하거나 세계관이 파괴되어 다음 턴으로 진행하지 못하는 극단적 결과를 내서는 안 됩니다. "일시적으로 기득권의 압박은 피했으나 본질을 잃어버려 다음 돌파구를 고민하게 된다"처럼, 과정의 변주를 주되 다음 턴의 정역사 상황(situation)으로 매끄럽게 수렴할 수 있는 '연속성 있는 중간 지문'으로 result_text를 작성하십시오.
9. 턴 간 시간선 전후 관계 일치 규칙:
   - 1턴(sort_order: 0) -> 2턴(sort_order: 1) -> 3턴(sort_order: 2)으로 진행됨에 따라, 각 턴 제목에 명시되는 연도(Year)는 반드시 '순차적 시간 흐름(크로놀로지)'을 따라야 합니다.
   - 앞선 턴보다 과거의 연도가 뒷 턴에 등장하거나, 인물의 생몰년도를 이탈하는 연도 할루시네이션을 절대 금지합니다.

반드시 아래 JSON 형식으로만 출력해:
{{
    "sort_order": 1,
    "title": "2턴 사건 명칭과 연도",
    "situation": "상황 묘사 2~3줄 (이전 1턴의 어떤 선택을 내렸어도 자연스럽게 흘러오도록 개연성 있게 2번째 갈등 국면을 작성)",
    "tip_title": "질문 형식의 토글 질문",
    "tip_desc": "질문에 대한 실제 역사적 해설 2~3줄",
    "choices": {{
        "A": {{
            "title": "선택지 A 제목",
            "description": "선택지 A 상세 행동 설명 1줄",
            "stats": {stats_format},
            "result_text": "이 선택을 한 후 보여줄 결과 지문 1~2줄",
            "is_historical": true
        }},
        "B": {{
            "title": "선택지 B 제목",
            "description": "선택지 B 상세 행동 설명 1줄",
            "stats": {stats_format},
            "result_text": "이 선택을 한 후 보여줄 결과 지문 1~2줄",
            "is_historical": false
        }}
    }}
}}"""
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "user", "content": prompt}
        ],
        response_format={"type": "json_object"}
    )
    
    data = json.loads(response.choices[0].message.content)
    return data


def generate_turn3_for_scenario(character_name: str, scenario_title: str, scenario_description: str, historical_facts: str, category: str, turn1_data: Dict[str, Any], turn2_data: Dict[str, Any]) -> Dict[str, Any]:
    if not openai_client:
        raise ValueError("OpenAI API 클라이언트가 존재하지 않아 턴 생성을 할 수 없습니다.")

    lifespan_info = HISTORICAL_LIFESPANS.get(character_name, {})
    lifespan_str = lifespan_info.get("years", "알 수 없음")
    stats_keys, stats_format = get_stats_keys_and_format(category)

    turn1_str = json.dumps(turn1_data, ensure_ascii=False, indent=2)
    turn2_str = json.dumps(turn2_data, ensure_ascii=False, indent=2)
    history_context = get_history_rag_context(character_name, scenario_title)

    prompt = f"""너는 역사 선택형 시뮬레이션 게임 'K-Heroes'의 턴 설계자야.
대상 인물인 '{character_name}'의 시나리오 '{scenario_title}'에 속한 세 번째 턴이자 최종 결말 턴(sort_order: 2)을 설계해 줘.
이전 1턴 and 2턴의 상황 및 각 선택 결과를 면밀히 분석하여, 전체 이야기 흐름이 자연스럽게 완결에 도달하도록 구성하십시오.
어려운 한자어는 피하고 초등학생도 쉽게 읽을 수 있는 단어를 써줘.
모든 출력 텍스트는 반드시 한국어로만 작성하십시오. 힌디어·아랍어·태국어 등 다른 언어를 절대 삽입하지 마십시오.

[대상 인물 및 역사적 타임라인 제약]
이름: {character_name}
실제 생몰년도 (활동 연대): {lifespan_str}

[시나리오 컨텍스트]
시나리오 제목: {scenario_title}
시나리오 설명: {scenario_description}
시나리오 핵심 역사적 팩트: {historical_facts}{history_context}

[이전 1턴 데이터]
{turn1_str}

[이전 2턴 데이터]
{turn2_str}

[설계 원칙]
1. 턴 흐름의 연속성 (보틀넥 수렴 구조):
   - 본 게임은 1턴과 2턴의 선택 결과에 상관없이 최종 3턴의 상황(situation)으로 수렴하여 결말을 맺는 구조입니다.
   - 2턴에서 어떤 선택(A 혹은 B)을 내렸더라도 매끄럽게 연결되는 3턴 상황(최종 결말 직전의 절정 국면)을 2~3줄의 situation으로 작성하십시오.
   - 3턴은 이 시나리오의 '최종 결말'이어야 하므로 결과 텍스트('result_text')는 최종 결말 지문 및 역사적 의의를 담아야 합니다.
2. 선택지 작명과 결과 뉘앙스:
   - 선택지 제목은 품위 있고 플레이어가 고르고 싶게 작성해.
   - 역사적 선택지 'A'는 역사적 팩트(is_historical: true)에 기반하고, 대체역사 선택지 'B'는 설득력 있는 대체역사(is_historical: false)여야 해.
3. 역사적 시대상 및 타임라인 준수:
   - 연도 기입 시, 반드시 {character_name}의 활동 연도인 {lifespan_str} 범위 내로 설정하며, 2턴의 연도보다 뒤의 연도로 자연스럽게 이어지도록 하십시오.
   - 조선 시대 배경일 때 '출판', '대중 유통' 등의 현대식 단어 대신 '필사본 유통', '목판본 간행' 같은 단어를 사용하십시오.
4. 주인공 중심: {character_name}가 주어가 되어 고민하고 선택하는 상황으로만 설계하십시오.
5. 게임 턴 스탯(stats) 규칙 (★최우선 순위 사안):
   - 선택지 A와 B의 'stats' 내부에 들어갈 3가지 키값은 인물 카드의 스탯과 무관하게, 반드시 다음의 게임 고정 스탯 3가지("{stats_keys}")만 사용해야 합니다.
   - 프롬프트에 임의로 정의된 다른 범용 키값은 예시일 뿐이므로 이를 절대로 출력하지 마십시오. 오직 위에서 제시한 3개의 고정 스탯 키만 사용하여 수치를 연산하십시오.
   - 수치 변동은 10~30 범위 내외의 정수(예: 15, -10 등)로 설정해 주십시오.
6. 이모티콘 금지: 모든 출력 텍스트(tip_title 포함)에 이모티콘이나 이모지(예: 💡)를 절대 포함하지 마십시오.
7. 범용 역사 고증 및 왜곡 방지 규칙 (모든 인물에 공통 적용):
   - 모든 서술(연도, 인명, 사건명, 단체명, 수치 등)의 근거는 반드시 제공된 RAG 컨텍스트(kf_area_total_merged.csv 데이터 및 교과서 정보)에 있는 내용이어야 합니다. RAG 컨텍스트에 없는 사실을 임의로 생성(hallucination)하지 마십시오.
   - 연도, 인명, 단체명 등 한 건 한 건의 고유명사는 RAG 컨텍스트에서 직접 확인된 경우에만 사용하십시오. 확인되지 않으면 구체적 표현을 피하고 일반적으로 서술하십시오.
   - 인물이 생존한 시대에 일어난 사건이라도, 그 인물이 실제 이끌거나 주도한 사항이 아닌 경우 그 인물의 업적이나 결정으로 서술하지 마십시오. 해당 시기 동일하게 활동한 타인의 업적이 주인공에게 귀속되지 않도록 RAG 컨텍스트를 치밀하게 분석하십시오.
   - 실책, 패배, 굴복, 친일 변절, 학살, 독재 등 도덕적으로 부정적이거나 역사적으로 비판받는 행적을 '환경 탓', '어쩔 수 없는 선택', '비극적 고뇌나 슬픔', '내적 갈등'으로 미화하거나 합리화하지 마십시오.
   - 부정적 행적은 변명 없이 객관적이고 중립적인 팩트로 직접 명시하십시오. '실패했다', '무력했다', '항복했다', '배반했다', '학살에 책임이 있다' 등 사실적 단어를 직접 사용하여 기록하고, 면죄부를 주지 마십시오.
   - 인물의 실제 생몰년도 ({lifespan_str}) 범위를 벗어나는 연도를 절대 사용하지 마십시오. 사망 이후의 사건을 주인공이 직접 공헌한 것처럼 서술하는 등 시대적 정합성에 위배되는 날조를 금지합니다.
   - RAG에 정확한 연도가 확인되지 않으면 임의로 연도를 지정하여 기입하지 말고 '대략적인 연대(예: 16세기 중반, 1890년대)'로 표현하십시오.
   - 인물이 살았던 당대에 존재하지 않는 기관, 제도, 어휘, 개념을 주인공에게 부여하지 마십시오. (예: 조선시대 인물에게 근대 서양 철학이나 자유민주주의, 무신론 개념 투영 금지, 조선 전기에 실학 개념 투영 금지)
   - 조선 시대 배경에서는 '출판', '대중 유통' 같은 현대식 단어 대신 '필사본 유통', '목판본 간행' 같은 단어를 사용하십시오.
   - 교과서 및 역사학계에서 공식 검증되지 않은 비공식/대중적 수식어(예: '세계 4대 해전 중 하나', '한반도의 실질적 지배자' 등)를 절대 사용하지 마십시오. '마지막 왕', '최초의 인물' 같은 절대적 수식어는 역사적 정설과 일치하는지 RAG 컨텍스트로 재확인한 후에만 사용하십시오.
8. 대체역사 선택지 'B'의 개연성 및 구체성 규칙 (안전한 보틀넥 구조):
   - 선택지 B는 "전통을 버리고 현대 춤을 추다", "강연회를 열다"와 같은 현대식 마케팅이나 뜬구름 잡는 추상적 행동으로 설계하면 게이미피케이션의 몰입도가 깨집니다.
   - 당대 역사적 정국(예: 조선 사대부들의 방해, 일제의 사상 검열, 유교 가문의 통제, 서양 음악 반주 채택 등)에서 주인공이 충분히 고민했을 법한 '부정적 타협안'이나 '다른 방식의 현실적 대안'을 선택지 B의 제목과 설명으로 구체화하십시오.
   - 플레이어가 B를 선택하더라도 주인공이 사망하거나 세계관이 파괴되어 다음 턴으로 진행하지 못하는 극단적 결과를 내서는 안 됩니다. "일시적으로 기득권의 압박은 피했으나 본질을 잃어버려 다음 돌파구를 고민하게 된다"처럼, 과정의 변주를 주되 다음 턴의 정역사 상황(situation)으로 매끄럽게 수렴할 수 있는 '연속성 있는 중간 지문'으로 result_text를 작성하십시오.
9. 턴 간 시간선 전후 관계 일치 규칙:
   - 1턴(sort_order: 0) -> 2턴(sort_order: 1) -> 3턴(sort_order: 2)으로 진행됨에 따라, 각 턴 제목에 명시되는 연도(Year)는 반드시 '순차적 시간 흐름(크로놀로지)'을 따라야 합니다.
   - 앞선 턴보다 과거의 연도가 뒷 턴에 등장하거나, 인물의 생몰년도를 이탈하는 연도 할루시네이션을 절대 금지합니다.
   
반드시 아래 JSON 형식으로만 출력해:
{{
    "sort_order": 2,
    "title": "3턴 사건 명칭과 연도 (예: 최종 결사 (1932년 4월 29일))",
    "situation": "상황 묘사 2~3줄 (최종 결말 상황 - 이전 턴들의 결정을 수렴하여 주인공이 마지막 결단을 내려야 하는 절정 국면 서술)",
    "tip_title": "질문 형식의 토글 질문",
    "tip_desc": "질문에 대한 실제 역사적 해설 2~3줄",
    "choices": {{
        "A": {{
            "title": "선택지 A 제목",
            "description": "선택지 A 상세 행동 설명 1줄",
            "stats": {stats_format},
            "result_text": "이 선택을 한 후 최종 결말 결과 지문 및 역사적 의의 2~3줄",
            "is_historical": true
        }},
        "B": {{
            "title": "선택지 B 제목",
            "description": "선택지 B 상세 행동 설명 1줄",
            "stats": {stats_format},
            "result_text": "이 선택을 한 후 최종 결말 결과 지문 및 역사적 의의 2~3줄",
            "is_historical": false
        }}
    }}
}}"""
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "user", "content": prompt}
        ],
        response_format={"type": "json_object"}
    )
    
    data = json.loads(response.choices[0].message.content)
    return data


def generate_turns_for_scenario(character_name: str, scenario_title: str, scenario_description: str, historical_facts: str, category: str) -> List[Dict[str, Any]]:
    print("      -> Turn 1 생성 중...")
    t1 = generate_turn1_for_scenario(character_name, scenario_title, scenario_description, historical_facts, category)
    print("      -> Turn 2 생성 중...")
    t2 = generate_turn2_for_scenario(character_name, scenario_title, scenario_description, historical_facts, category, t1)
    print("      -> Turn 3 생성 중...")
    t3 = generate_turn3_for_scenario(character_name, scenario_title, scenario_description, historical_facts, category, t1, t2)
    return [t1, t2, t3]


# --- OpenAI Image Generators & GCS Upload ---
def generate_and_upload_character_image(character_name: str) -> str:
    """
    OpenAI gpt-image-2를 이용하여 캐릭터 전신 일러스트를 생성하고 GCS에 업로드.
    """
    if not openai_client:
        print("[WARNING] OpenAI API 클라이언트가 존재하지 않습니다.")
        return ""
    if not GCP_BUCKET_NAME:
        print("[WARNING] GCP_BUCKET_NAME 설정되지 않음.")
        return ""

    prompt = f"""Heroic portrait of {character_name}.
K-Heroes historical character illustration.
Depict the most iconic and historically recognizable version of the character.
Automatically include historically accurate clothing, hairstyle, symbolic item, and representative historical elements.
Standing confidently in the center.
Traditional Korean watercolor illustration mixed with ink wash painting (sumukhwa).
Character occupies approximately 75% of the composition.
Historical elements appear only as soft watercolor accents behind the character.
No full background scene.
No sky, ground, horizon, or solid backdrop.
Background must be solid white.
Isolated on a clean, solid white background.
No checkered pattern, no grid, no grey and white squares.
Clean character cutout.
Museum-quality illustration.
Warm beige, brown, olive green and ivory palette.
Semi-realistic painting style.
High detail.
4:5 portrait composition.
No text, logo, border, frame, or UI."""

    try:
        print(f" ➔ 전신 이미지 생성 요청 중 ({character_name})...")
        response = openai_client.images.generate(
            model="gpt-image-2",
            prompt=prompt,
            n=1,
            size="1024x1792",
            quality="high"
        )
        
        b64_data = response.data[0].b64_json
        if not b64_data:
            raise Exception("No image data returned from OpenAI API.")
            
        image_bytes = base64.b64decode(b64_data)
        
        # Convert white background to transparency using PIL floodfill
        try:
            print(" ➔ 이미지 배경 투명화 처리 중 (Pillow)...")
            from PIL import Image, ImageDraw
            img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
            width, height = img.size
            
            # Sample border pixels (every 10 pixels along the borders)
            border_pixels = []
            for x in range(0, width, 10):
                border_pixels.append((x, 0))
                border_pixels.append((x, height - 1))
            for y in range(0, height, 10):
                border_pixels.append((0, y))
                border_pixels.append((width - 1, y))
                
            for px, py in border_pixels:
                r, g, b, a = img.getpixel((px, py))
                # If pixel is light enough (R > 210, G > 210, B > 210) and not already transparent
                if a > 0 and r > 210 and g > 210 and b > 210:
                    ImageDraw.floodfill(img, (px, py), (0, 0, 0, 0), thresh=50)
                    
            output_bytes = io.BytesIO()
            img.save(output_bytes, format="PNG")
            image_bytes = output_bytes.getvalue()
            print("  [SUCCESS] 배경 투명화 완료!")
        except Exception as img_err:
            print(f" [WARNING] 배경 투명화 처리 실패 (원본 이미지 유지): {img_err}")
            
        storage_client = storage.Client(project=GCP_PROJECT_ID)
        bucket = storage_client.bucket(GCP_BUCKET_NAME)
        
        blob_name = f"characters/{character_name}.png"
        blob = bucket.blob(blob_name)
        
        print(f" ➔ GCS 업로드: gs://{GCP_BUCKET_NAME}/{blob_name}")
        blob.upload_from_string(image_bytes, content_type="image/png")
        
        public_url = f"https://storage.googleapis.com/{GCP_BUCKET_NAME}/{blob_name}"
        return public_url
    except Exception as e:
        print(f" [ERROR] '{character_name}' 이미지 생성/GCS 실패: {e}")
        return ""

def generate_and_upload_turn_image(character_name: str, turn_situation: str, scenario_id: int, sort_order: int) -> str:
    step_no = _turn_step_no(sort_order)
    """
    OpenAI gpt-image-2를 이용하여 상황(턴)별 키아트 일러스트를 생성하고 GCS에 업로드 (16:9 가로).
    """
    if not openai_client:
        print("[WARNING] OpenAI API 클라이언트가 존재하지 않습니다.")
        return ""
    if not GCP_BUCKET_NAME:
        print("[WARNING] GCP_BUCKET_NAME 설정되지 않음.")
        return ""

    prompt = f"""{character_name}

{turn_situation}

K-Heroes historical scenario illustration.
Show {character_name} in the moment of {turn_situation}.
Focus on both the main character and the historical situation.
The scene should clearly communicate the story and decision context of the event.
Historical setting and period-accurate clothing.
Authentic architecture, environment and cultural elements appropriate to the era.
Strong emotional storytelling.
Cinematic composition.
Story-focused illustration.
Main character clearly visible and occupies approximately 40~50% of the composition.
Historical environment and story elements occupy approximately 50~60% of the composition.
One important historical object, landmark, building, weapon, document or symbolic element should subtly stand out through slightly richer color and contrast.
Create a natural visual focal point while maintaining harmony with the overall artwork.
Traditional Korean watercolor illustration mixed with ink wash painting (sumukhwa).
Premium Korean cultural heritage artwork.
Warm ivory paper texture.
Elegant brush strokes.
Soft watercolor edges.
Semi-realistic painting style.
Warm beige, brown, olive green and ivory palette.
Historical atmosphere.
Museum-quality educational game artwork.
No text.
No logo.
No UI.
No border.
No frame.
16:9 composition.
4K quality."""

    try:
        print(f" ➔ gpt-image-2 턴 상황 이미지 생성 요청 중 ({character_name} 시나리오 {scenario_id} 턴 {step_no})...")
        response = openai_client.images.generate(
            model="gpt-image-2",
            prompt=prompt,
            n=1,
            size="1792x1024",
            quality="high"
        )
        
        b64_data = response.data[0].b64_json
        if not b64_data:
            raise Exception("No image data returned from OpenAI API.")
            
        image_bytes = base64.b64decode(b64_data)
        
        storage_client = storage.Client(project=GCP_PROJECT_ID)
        bucket = storage_client.bucket(GCP_BUCKET_NAME)
        
        blob_name = f"scenarios/{character_name}_scenario_{scenario_id}_turn_{step_no}.png"
        blob = bucket.blob(blob_name)
        
        print(f" ➔ GCS 업로드: gs://{GCP_BUCKET_NAME}/{blob_name}")
        blob.upload_from_string(image_bytes, content_type="image/png")
        
        public_url = f"https://storage.googleapis.com/{GCP_BUCKET_NAME}/{blob_name}"
        return public_url
    except Exception as e:
        print(f" [ERROR] '{character_name}' 시나리오 {scenario_id} 턴 {step_no} 상황 이미지 생성/GCS 실패: {e}")
        return ""

def generate_and_upload_choice_image(character_name: str, choice_text: str, scenario_id: int, sort_order: int, choice_key: str) -> str:
    step_no = _turn_step_no(sort_order)
    """
    OpenAI gpt-image-2를 이용하여 선택지(A/B)별 일러스트를 생성하고 GCS에 업로드 (4:3 -> 1:1).
    """
    if not openai_client:
        print("[WARNING] OpenAI API 클라이언트가 존재하지 않습니다.")
        return ""
    if not GCP_BUCKET_NAME:
        print("[WARNING] GCP_BUCKET_NAME 설정되지 않음.")
        return ""

    prompt = f"""{character_name}

{choice_text}

K-Heroes historical decision illustration.
Show {character_name} in the moment of {choice_text}.
Focus on the historical situation, action and environment rather than the character portrait.
The scene should clearly communicate the choice being made.
Historical setting and period-accurate clothing.
Authentic architecture, environment and cultural elements appropriate to the era.
One clear action that represents the decision or event.
Strong emotional storytelling.
Focused composition.
Suitable for a choice card.
Character occupies approximately 20~30% of the composition.
Environment and story occupy approximately 70~80% of the composition.
Traditional Korean watercolor and ink wash painting style.
Warm ivory paper texture.
Semi-realistic painting style.
Mostly muted beige, brown, olive green and ivory palette.
One important object, landmark, flag, weapon, invention, building or symbolic element should be rendered with slightly richer color and contrast to naturally draw the viewer's eye.
Use cinematic visual hierarchy.
Create a clear focal point.
The highlighted object must remain historically accurate and harmonious with the overall palette.
Soft watercolor edges.
Historical atmosphere.
No text.
No logo.
No UI.
No border.
No frame.
4:3 composition.
4K quality."""

    try:
        print(f" ➔ gpt-image-2 선택지 이미지 생성 요청 중 ({character_name} 시나리오 {scenario_id} 턴 {step_no} 선택지 {choice_key})...")
        response = openai_client.images.generate(
            model="gpt-image-2",
            prompt=prompt,
            n=1,
            size="1024x1024",
            quality="high"
        )
        
        b64_data = response.data[0].b64_json
        if not b64_data:
            raise Exception("No image data returned from OpenAI API.")
            
        image_bytes = base64.b64decode(b64_data)
        
        # Crop to 4:3 (1024x768)
        try:
            print(" ➔ 선택지 이미지 4:3 크롭 처리 중 (Pillow)...")
            from PIL import Image
            img = Image.open(io.BytesIO(image_bytes))
            cropped_img = img.crop((0, 128, 1024, 896))
            output_bytes = io.BytesIO()
            cropped_img.save(output_bytes, format="PNG")
            image_bytes = output_bytes.getvalue()
        except Exception as crop_err:
            print(f" [WARNING] Pillow 크롭 처리 중 오류 발생 (원본 그대로 업로드): {crop_err}")
        
        storage_client = storage.Client(project=GCP_PROJECT_ID)
        bucket = storage_client.bucket(GCP_BUCKET_NAME)
        
        blob_name = f"scenarios/{character_name}_scenario_{scenario_id}_turn_{step_no}_choice_{choice_key}.png"
        blob = bucket.blob(blob_name)
        
        print(f" ➔ GCS 업로드: gs://{GCP_BUCKET_NAME}/{blob_name}")
        blob.upload_from_string(image_bytes, content_type="image/png")
        
        public_url = f"https://storage.googleapis.com/{GCP_BUCKET_NAME}/{blob_name}"
        return public_url
    except Exception as e:
        print(f" [ERROR] '{character_name}' 시나리오 {scenario_id} 턴 {step_no} 선택지 {choice_key} 이미지 생성/GCS 실패: {e}")
        return ""

def generate_and_upload_ending_image(character_name: str, ending_title: str, story_contents: str, scenario_id: int, choices_path_str: str) -> str:
    """
    OpenAI gpt-image-2를 이용하여 엔딩 일러스트를 생성하고 GCS에 업로드 (16:9 가로).
    """
    if not openai_client:
        print("[WARNING] OpenAI API 클라이언트가 존재하지 않습니다.")
        return ""
    if not GCP_BUCKET_NAME:
        print("[WARNING] GCP_BUCKET_NAME 설정되지 않음.")
        return ""

    # 심플하게 적어둔 프롬프트 (사용자가 추후 전달할 프롬프터가 들어갈 자리)
    prompt = f"""{character_name} - {ending_title}

K-Heroes historical ending scenario illustration.
Show {character_name} in the dramatic conclusion of: {story_contents}.
Watercolor illustration in warm tone. Ivory paper texture. Elegant brush strokes.
No text, no logo, no UI. 16:9 composition."""

    try:
        print(f" ➔ gpt-image-2 엔딩 이미지 생성 요청 중 ({character_name} 시나리오 {scenario_id} 경로 {choices_path_str})...")
        response = openai_client.images.generate(
            model="gpt-image-2",
            prompt=prompt,
            n=1,
            size="1792x1024",
            quality="high"
        )
        
        b64_data = response.data[0].b64_json
        if not b64_data:
            raise Exception("No image data returned from OpenAI API.")
            
        image_bytes = base64.b64decode(b64_data)
        
        storage_client = storage.Client(project=GCP_PROJECT_ID)
        bucket = storage_client.bucket(GCP_BUCKET_NAME)
        
        blob_name = f"endings/{character_name}_scenario_{scenario_id}_ending_{choices_path_str}.png"
        blob = bucket.blob(blob_name)
        
        print(f" ➔ GCS 업로드: gs://{GCP_BUCKET_NAME}/{blob_name}")
        blob.upload_from_string(image_bytes, content_type="image/png")
        
        public_url = f"https://storage.googleapis.com/{GCP_BUCKET_NAME}/{blob_name}"
        return public_url
    except Exception as e:
        print(f" [ERROR] '{character_name}' 엔딩 이미지 생성/GCS 실패: {e}")
        return ""

def generate_endings_text_for_character_scenario(character_name: str, target_scenario_id: Optional[int] = None):
    """
    지정된 캐릭터의 시나리오별 8가지 분기 경로(A-A-A ~ B-B-B)에 대한 엔딩 텍스트를 생성하고
    backend/data/endings/{character_name}_{scenario_id}.json 파일로 빌드.
    """
    from models.character.character import CharacterCard
    from simulation_data_manager import get_recommended_places
    
    # 1. characters.json 로딩
    if not os.path.exists(CHARACTERS_JSON_PATH):
        print(f"[ERROR] characters.json 파일이 존재하지 않습니다: {CHARACTERS_JSON_PATH}")
        return
        
    with open(CHARACTERS_JSON_PATH, "r", encoding="utf-8") as f:
        character_database = json.load(f)
        
    if character_name not in character_database:
        print(f"[ERROR] '{character_name}' 인물 프로필 정보가 characters.json에 없습니다.")
        return
        
    from simulation_data_manager import get_character_card
    character_card = get_character_card(character_name)
    
    # endings 디렉토리 생성
    endings_dir = os.path.join(BASE_DIR, "data", "endings")
    os.makedirs(endings_dir, exist_ok=True)
    
    # 8가지 선택 조합 생성
    combinations = []
    for c1 in ["A", "B"]:
        for c2 in ["A", "B"]:
            for c3 in ["A", "B"]:
                combinations.append([c1, c2, c3])
                
    for scenario in character_card.scenarios:
        s_id = scenario.sort_order + 1
        if target_scenario_id is not None and s_id != target_scenario_id:
            continue
            
        print(f"\n➔ '{character_name}' 시나리오 {s_id} ('{scenario.title}') 8개 분기 엔딩 텍스트 생성 시작...")
        
        # 기존 저장 데이터가 있다면 병합(Overwrite 방지)을 위해 로드
        filepath = os.path.join(endings_dir, f"{character_name}_{s_id}.json")
        existing_endings = {}
        if os.path.exists(filepath):
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    existing_endings = json.load(f)
            except Exception as e:
                print(f"  [WARNING] 기존 엔딩 JSON 파일 읽기 실패 (새로 빌드): {e}")
                
        scenario_endings = {}
        
        # 1회성 RAG 검색 수행
        rag_context = ""
        try:
            db_pkl_path = os.path.join(BASE_DIR, "data", "processed", "history_db.pkl")
            rag_instance = get_rag_instance(db_path=db_pkl_path)
            results = rag_instance.retrieve(f"{character_name} {scenario.title}", top_k=3)
            if results:
                rag_context = "\n".join([f"- {r['chunk']}" for r in results])
                
                # RAG 검색 결과 평가 적재
                try:
                    from rag_evaluator import RAGEvaluator
                    evaluator = RAGEvaluator()
                    evaluator.evaluate_retrieved_context(
                        character_name=character_name,
                        query=f"{character_name} {scenario.title}",
                        retrieved_results=results,
                        mode="offline"
                    )
                except Exception as eval_err:
                    print(f"  [WARNING] 엔딩 RAG 검색 결과 평가 실패: {eval_err}")
        except Exception as e:
            print(f"  [WARNING] RAG 조회 중 오류 (생략 가능): {e}")
            
        # 기타 인물 행적 배경 단서 수집
        from simulation_data_manager import get_retrieved_clues
        other_clues = get_retrieved_clues(character_name)
        context_str = "[기타 인물 행적 배경 단서]\n"
        for clue in other_clues[:5]:
            context_str += f"- {clue['text']}\n"
        if rag_context:
            context_str += f"\n[국사 교과서 RAG 단서]\n{rag_context}\n"
            
        # 추천 방문지 일괄 조회 (시나리오의 스토리 ID 기반 우선 검색)
        recommended_places = get_recommended_places(character_name, source_story_ids=scenario.source_story_ids)
        recommended_places_dict = [place.dict() for place in recommended_places]
        
        for choices_path in combinations:
            path_key = "-".join(choices_path)
            
            if path_key in existing_endings and "title" in existing_endings[path_key]:
                print(f"   ➔ 경로 {path_key}는 이미 생성되어 있어 패스합니다.")
                scenario_endings[path_key] = existing_endings[path_key]
                continue
                
            print(f"   ➔ 경로 {path_key} 엔딩 텍스트 생성 중...")
            
            # 1.5. Calculate history_score & current_stats
            total_turns = len(scenario.turns)
            historical_choices_count = 0
            stat_lookup = {stat.id: stat for stat in character_card.turn_stats}
            current_by_id = {stat.id: stat.value for stat in character_card.turn_stats}

            for idx, turn in enumerate(scenario.turns):
                user_choice_id = choices_path[idx]
                user_choice = turn.choices.get(user_choice_id)
                if not user_choice:
                    user_choice = list(turn.choices.values())[0]

                if user_choice.is_historical:
                    historical_choices_count += 1

                for item in user_choice.turn_stats:
                    if item.turn_stats_id in current_by_id:
                        current_by_id[item.turn_stats_id] += item.delta

            current_stats = {
                stat_lookup[turn_stats_id].name: value
                for turn_stats_id, value in current_by_id.items()
                if turn_stats_id in stat_lookup
            }
                        
            history_score = round((historical_choices_count / total_turns) * 100) if total_turns > 0 else 100
            is_all_historical = (historical_choices_count == total_turns)
            
            # Compile stories
            factual_story_parts = []
            user_story_parts = []
            
            for idx, turn in enumerate(scenario.turns):
                situation = turn.situation
                user_choice_id = choices_path[idx]
                user_choice = turn.choices.get(user_choice_id)
                if not user_choice:
                    user_choice = list(turn.choices.values())[0]
                    
                hist_choice_id = "A"
                for cid, choice in turn.choices.items():
                    if choice.is_historical:
                        hist_choice_id = cid
                        break
                hist_choice = turn.choices.get(hist_choice_id)
                
                user_story_parts.append(
                    f"STEP {idx+1}. {situation}\n"
                    f"- 선택: {user_choice.title} ({'실제 역사' if user_choice.is_historical else '가상 분기'})\n"
                    f"- 결과: {user_choice.result_text}"
                )
                factual_story_parts.append(
                    f"STEP {idx+1}. {situation}\n"
                    f"- 실제 역사 선택: {hist_choice.title}\n"
                    f"- 결과: {hist_choice.result_text}"
                )
                
            user_compiled_story = "\n\n".join(user_story_parts)
            factual_compiled_story = "\n\n".join(factual_story_parts)
            
            stats_str = {name: f"{val}%" for name, val in current_stats.items()}
            
            ending_prompt = f"""
너는 역사 선택형 시뮬레이션 게임 'K-Heroes'의 최종 엔딩 연출가야.
유저가 게임 도중 내린 선택과 그로 인해 발생한 이야기를 토대로 최종 감동적인 엔딩, 실제 역사와의 비교, 그리고 관련 역사적 방문지를 매칭해 줘.

[대상 인물]
이름: {character_name}

[시나리오]
제목: {scenario.title}
역사적 사실 요약: {scenario.historical_facts}
스토리 ID 데이터: {scenario.source_story_ids}

[국사교과서 및 RAG 역사 단서]
{context_str}

[DB에서 검색된 실제 관련 장소 후보]
{json.dumps(recommended_places_dict, ensure_ascii=False, indent=2)}

[유저의 플레이 기록]
- 유저의 선택 경로: {choices_path} (역사 점수: {history_score}/100점)
- 플레이어 능력치 상태: {stats_str}

[스토리 소스 (characters.json 기준)]
1. 유저가 만든 역사 이야기 흐름:
{user_compiled_story}

2. 실제 역사 이야기 흐름:
{factual_compiled_story}

# 1. 엔딩 설계 및 화면 연출 원칙 (UI/UX 기반)
1. 엔딩 유형 (ending_type): 
   - 역사 점수가 100점인 경우 또는 모든 선택이 역사적 선택(is_historical: true)인 경우: "True Ending"
   - 그 외의 가상 역사 경로를 단 하나라도 거친 경우: "Alternative Ending"
2. 엔딩 타이틀 (title): UI 상단의 핵심 타이틀입니다. 유저의 엔딩 흐름에 맞는 감동적이고 웅장한 타이틀을 지어주세요.
3. 내가 만든 이야기 (Result Section):
   - story_headline: 효과음이나 인물의 대사로 시작하는 강렬한 느낌의 헤드라인 1줄 (반드시 큰따옴표 포함, 예: "쾅-!!! 공원을 뒤흔든 위대한 폭발!")
   - story_contents: 유저의 선택들이 만들어낸 서사 결과를 초등학생 눈높이에 맞게 쉽고 웅장한 톤으로 2-3줄 요약해 주세요.
   - factual_contents: 유저의 선택과 무관하게 '실제 역사 속 인물'이 마주했던 객관적인 팩트 중심의 결말을 2-3줄로 명확히 정돈해 주세요.
4. 실제 역사와의 차이 (history_fact): 
   - 토글 박스 내부에 들어갈 텍스트입니다. 제공된 RAG 데이터와 실제 역사 흐름을 바탕으로, 유저의 선택이 실제 역사와 어떤 차이가 있고 이것이 주는 역사적 교훈이 무엇인지 친절하고 상세하게(3-4줄) 서술해 주세요.
5. 결과 요약 (summary_items): 
   - 화면 중앙의 1, 2, 3번 요약 섹션입니다. 이번 시나리오의 핵심 교훈이나 유저의 활약을 3개의 요약 항목 리스트(각각 title과 desc로 구성)로 작성해 주세요.
6. 추천 방문지 (places):
   - 위에서 제공된 **[DB에서 검색된 실제 관련 장소 후보]** 목록 중에서 현재 인물 및 시나리오 사건과 가장 잘 어울리는 **명소/기념관 2곳**을 엄격히 발췌하여 작성하십시오.
   - 반드시 제공된 후보 목록에 있는 장소만 사용해야 하며, 후보에 명시되지 않은 엉뚱한 현대 관광지나 허구의 장소를 절대 지어내지 마십시오.

# 2. 범용 역사 고증 및 왜곡 방지 규칙 (MUST FOLLOW)
- 초등학생 눈높이에 맞게 어려운 한자어(예: 비준, 늑약, 사문난적 등)는 본문에서 풀어서 설명하거나 쉬운 단어로 대체하십시오.
- 모든 서술의 근거는 반드시 제공된 RAG 컨텍스트에 있는 내용이어야 합니다. 컨텍스트에 없는 사실을 임의로 생성(hallucination)하지 마십시오.
- 인물의 실책, 패배, 굴복, 변절 등 부정적이거나 역사적으로 비판받는 행적을 유저가 선택했을 경우, 이를 '어쩔 수 없는 선택'이나 '비극적 고뇌'로 미화하거나 합리화하지 말고 객관적인 실패 팩트로 서술하십시오.
- 인물의 실제 생몰년도 범위를 벗어나는 사건이나 사후의 업적을 인물이 직접 공헌한 것처럼 시공간을 날조하여 서술하는 것을 절대 금지합니다.
- 모든 출력 텍스트에 이모티콘이나 이모지(예: 💡, 🌟)를 절대 포함하지 마십시오.

반드시 마크다운 등 다른 텍스트 없이 아래 JSON 형식으로만 응답할 것:
{{
    "ending_type": "True Ending" 또는 "Alternative Ending",
    "title": "엔딩 타이틀",
    "history_fact": "실제 역사와의 차이점 비교 및 역사적 교훈 해설",
    "story_headline": "효과음이나 대사가 포함된 강렬한 헤드라인 1줄",
    "story_contents": "유저 선택 기반의 서사 결과 2-3줄",
    "factual_contents": "실제 역사 기반의 사실적 결말 2-3줄",
    "summary_items": [
        {{"title": "요약 제목 1", "desc": "요약 설명 1"}},
        {{"title": "요약 제목 2", "desc": "요약 설명 2"}},
        {{"title": "요약 제목 3", "desc": "요약 설명 3"}}
    ],
    "places": [
        {{
            "place_id": 1,
            "name": "첫 번째 추천 방문지 이름 (예: 매헌윤봉길의사기념관)",
            "address": "행정구역 주소 (예: 서울특별시 서초구 양재동)",
            "desc": "이 장소가 해당 인물/사건과 어떤 연관이 있는지에 대한 객관적 설명 1~2줄"
        }},
        {{
            "place_id": 2,
            "name": "두 번째 추천 방문지 이름 (예: 충의사 (윤봉길 의사 생가))",
            "address": "행정구역 주소 (예: 충청남도 예산군 덕산면)",
            "desc": "장소 연관성 설명 1~2줄"
        }}
    ]
}}
"""
            ending_data = None
            from rag_evaluator import RAGEvaluator
            evaluator = RAGEvaluator()
            
            # 품질 만족 시까지 최대 3회 엔딩 재생성 시도
            for gen_attempt in range(1, 4):
                print(f"   ➔ 경로 {path_key} 엔딩 텍스트 생성 및 품질 평가 시도 ({gen_attempt}/3)...")
                
                # OpenAI API 호출 (API 오류 대비 최대 3회 재시도)
                ending_result = None
                for api_attempt in range(3):
                    try:
                        response = openai_client.chat.completions.create(
                            model="gpt-4o",
                            messages=[{"role": "user", "content": ending_prompt}],
                            response_format={"type": "json_object"}
                        )
                        ending_result = response.choices[0].message.content
                        break
                    except Exception as e:
                        print(f"    [WARNING] 엔딩 API 호출 실패 (시도 {api_attempt+1}): {e}")
                        time.sleep(5)
                        
                if not ending_result:
                    print(f"    [ERROR] 경로 {path_key} API 최종 실패")
                    break
                    
                temp_ending_data = json.loads(ending_result)
                
                # 고증 품질 평가 수행
                try:
                    eval_log = evaluator.evaluate_ending_quality(
                        character_name=character_name,
                        rag_context=rag_context,
                        generated_ending=temp_ending_data,
                        user_compiled_story=user_compiled_story
                    )
                    metrics = eval_log.get("metrics", {})
                    facts_score = metrics.get("facts_consistency", 3)
                    glorification_score = metrics.get("glorification_bias", 3)
                    story_flow_score = metrics.get("story_flow_coherence", 3)
                    
                    print(f"      [EVAL] Facts: {facts_score}/5, Glorification: {glorification_score}/5, Story Flow: {story_flow_score}/5")
                    
                    # 팩트 정합성, 미화도 및 스토리 흐름 개연성이 4점 이상이면 최종 승인
                    if facts_score >= 4 and glorification_score >= 4 and story_flow_score >= 4:
                        ending_data = temp_ending_data
                        print(f"      [APPROVED] 엔딩 품질 승인 완료 (Facts: {facts_score}, Glorification: {glorification_score}, Story Flow: {story_flow_score})")
                        break
                    else:
                        print(f"      [REJECTED] 고증 및 개연성 품질 불만족으로 재생성을 예약합니다.")
                except Exception as eval_err:
                    print(f"      [WARNING] 엔딩 품질 평가 오류(임시 승인): {eval_err}")
                    ending_data = temp_ending_data
                    break
            
            if not ending_data:
                print(f"    [ERROR] 경로 {path_key} 최종 승인 가능한 엔딩을 생성하지 못했습니다. 마지막 데이터를 임시 저장합니다.")
                if 'temp_ending_data' in locals():
                    ending_data = temp_ending_data
                else:
                    continue
            
            # 기존 이미지 URL 보존
            existing_img = existing_endings.get(path_key, {}).get("image_url", "")
            
            scenario_endings[path_key] = {
                "ending_type": "True Ending" if (is_all_historical or history_score >= 100) else "Alternative Ending",
                "title": ending_data.get("title", ""),
                "history_fact": ending_data.get("history_fact", ""),
                "story_headline": ending_data.get("story_headline", "").strip('"\''),
                "story_contents": ending_data.get("story_contents", ""),
                "factual_contents": ending_data.get("factual_contents", ""),
                "summary_items": ending_data.get("summary_items", []),
                "recommended_places": ending_data.get("places", []),
                "image_url": existing_img
            }
            
        # 결과 파일 쓰기
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(scenario_endings, f, ensure_ascii=False, indent=4)
        print(f"  [SUCCESS] '{character_name}' 시나리오 {s_id} 엔딩 텍스트 파일 저장 완료: {filepath}")

def generate_endings_images_for_character_scenario(character_name: str, target_scenario_id: Optional[int] = None):
    """
    기존에 생성된 backend/data/endings/{character_name}_{scenario_id}.json 파일을 로드하여,
    각 분기 경로별 엔딩 일러스트를 gpt-image-2로 생성하고 GCS에 업로드하여 image_url을 업데이트.
    """
    from models.character.character import CharacterCard
    
    endings_dir = os.path.join(BASE_DIR, "data", "endings")
    
    # 1. characters.json에서 인물 시나리오 찾기
    if not os.path.exists(CHARACTERS_JSON_PATH):
        print(f"[ERROR] characters.json 파일이 존재하지 않습니다: {CHARACTERS_JSON_PATH}")
        return
        
    with open(CHARACTERS_JSON_PATH, "r", encoding="utf-8") as f:
        character_database = json.load(f)
        
    if character_name not in character_database:
        print(f"[ERROR] '{character_name}' 인물 정보가 characters.json에 없습니다.")
        return
        
    from simulation_data_manager import get_character_card
    character_card = get_character_card(character_name)
    
    for scenario in character_card.scenarios:
        s_id = scenario.sort_order + 1
        if target_scenario_id is not None and s_id != target_scenario_id:
            continue
            
        filepath = os.path.join(endings_dir, f"{character_name}_{s_id}.json")
        if not os.path.exists(filepath):
            print(f"[WARNING] 시나리오 {s_id}의 엔딩 텍스트 파일이 존재하지 않습니다. 먼저 --endings-text를 실행하세요. ({filepath})")
            continue
            
        with open(filepath, "r", encoding="utf-8") as f:
            endings_data = json.load(f)
            
        print(f"\n➔ '{character_name}' 시나리오 {s_id} 엔딩 일러스트 생성 시작...")
        
        updated = False
        for path_key, ending in endings_data.items():
            title = ending.get("title", "")
            story_contents = ending.get("story_contents", "")
            existing_img = ending.get("image_url", "")
            
            if not existing_img or not existing_img.startswith("http"):
                print(f"   ➔ 경로 {path_key} 일러스트가 없습니다. 생성 중...")
                public_url = generate_and_upload_ending_image(character_name, title, story_contents, s_id, path_key)
                if public_url:
                    ending["image_url"] = public_url
                    updated = True
                    # 쓰기 반영 (매번 실패를 대비해 증분 저장)
                    with open(filepath, "w", encoding="utf-8") as f:
                        json.dump(endings_data, f, ensure_ascii=False, indent=4)
                    print(f"    [SUCCESS] 경로 {path_key} 일러스트 생성 완료: {public_url}")
                    time.sleep(5)
            else:
                print(f"   ➔ 경로 {path_key} 일러스트가 이미 존재합니다: {existing_img}")
                
        if updated:
            print(f"  [SUCCESS] '{character_name}' 시나리오 {s_id} 엔딩 일러스트 업데이트 완료.")


# --- Main Pipeline Builder ---
def run_main_pipeline(target_char: Optional[str] = None, mode: str = "all"):
    norm_mode = mode.lower().strip().lstrip("-") if mode else "all"
    
    VALID_MODES = {
        "all",
        "profiles-text",
        "scenarios-text",
        "turns-text",
        "turn1-text",
        "turn2-text",
        "turn3-text",
        "endings-text",
        "profiles-image",
        "turns-image",
        "endings-image"
    }
    
    if norm_mode not in VALID_MODES:
        print(f"[ERROR] 지원하지 않거나 폐기된 모드입니다: --{mode}")
        print("사용 가능한 명령어 목록:")
        print("  python scenario_generator.py --all [캐릭터명]             : 프로필 텍스트 및 모든 이미지(전신/상황/선택지) 일괄 생성 (특정 캐릭터 지정 가능)")
        print("  python scenario_generator.py --profiles-text [캐릭터명]   : 이미지 생성 없이 캐릭터 프로필 정보만 생성/갱신 (특정 캐릭터 지정 가능)")
        print("  python scenario_generator.py --scenarios-text [캐릭터명]  : 이미지 생성 없이 시나리오 메타데이터(테마) 정보만 생성 (특정 캐릭터 지정 가능)")
        print("  python scenario_generator.py --turns-text [캐릭터명]      : 시나리오 1, 2, 3턴 텍스트 정보만 순차 생성 (특정 캐릭터 지정 가능)")
        print("  python scenario_generator.py --endings-text [캐릭터명]    : 8가지 경우의 엔딩 스토리 텍스트 일괄 사전 생성 (캐릭터 지정 필수)")
        print()
        print("  python scenario_generator.py --profiles-image [캐릭터명]  : 캐릭터 전신 일러스트(프로필 카드용)만 생성 (특정 캐릭터 지정 가능)")
        print("  python scenario_generator.py --turns-image [캐릭터명]     : 시나리오 내 모든 턴 상황 및 선택지 이미지(GCS) 생성 (특정 캐릭터 지정 가능)")
        print("  python scenario_generator.py --endings-image [캐릭터명]   : 8가지 엔딩 일러스트(DALL-E) 일괄 사전 생성 (캐릭터 지정 필수)")
        return
    
    if norm_mode == "endings-text":
        chars_to_run = []
        if not target_char or target_char.lower() == "all":
            if os.path.exists(CHARACTERS_JSON_PATH):
                try:
                    with open(CHARACTERS_JSON_PATH, "r", encoding="utf-8") as f:
                        character_database = json.load(f)
                    chars_to_run = list(character_database.keys())
                except Exception as e:
                    print(f"[ERROR] characters.json 로드 실패: {e}")
            if not chars_to_run:
                print("[ERROR] characters.json에 캐릭터 데이터가 없거나 로드에 실패했습니다.")
                return
        else:
            chars_to_run = [target_char]
            
        print(f"[INFO] 엔딩 텍스트 일괄 생성 시작 (대상 인물: {chars_to_run})")
        for char in chars_to_run:
            generate_endings_text_for_character_scenario(char)
        return
        
    if norm_mode == "endings-image":
        chars_to_run = []
        if not target_char or target_char.lower() == "all":
            if os.path.exists(CHARACTERS_JSON_PATH):
                try:
                    with open(CHARACTERS_JSON_PATH, "r", encoding="utf-8") as f:
                        character_database = json.load(f)
                    chars_to_run = list(character_database.keys())
                except Exception as e:
                    print(f"[ERROR] characters.json 로드 실패: {e}")
            if not chars_to_run:
                print("[ERROR] characters.json에 캐릭터 데이터가 없거나 로드에 실패했습니다.")
                return
        else:
            chars_to_run = [target_char]
            
        print(f"[INFO] 엔딩 이미지 일괄 생성 시작 (대상 인물: {chars_to_run})")
        for char in chars_to_run:
            generate_endings_images_for_character_scenario(char)
        return
        
    print(f"[INFO] 마스터 CSV 파일 로드 시도: {CSV_PATH}")
    if not os.path.exists(CSV_PATH):
        raise FileNotFoundError(f"마스터 CSV 파일이 존재하지 않습니다: {CSV_PATH}")
        
    df = pd.read_csv(CSV_PATH, encoding="utf-8-sig")
    print(f"[SUCCESS] CSV 로드 완료: {len(df):,}행")
    
    df_clean = df.dropna(subset=["relate_prsn_nm"]).copy()
    df_clean["relate_prsn_nm"] = df_clean["relate_prsn_nm"].astype(str).str.strip()
    df_clean = df_clean[df_clean["relate_prsn_nm"] != ""]
    
    person_counts = df_clean["relate_prsn_nm"].value_counts()
    
    min_stories_threshold = 78
    selected_characters = [name for name, count in person_counts.items() if count >= min_stories_threshold]
    
    # 이순신 강제 추가
    special_characters = ["이순신"]
    for name in special_characters:
        if name not in selected_characters and name in person_counts:
            selected_characters.append(name)
            
    selected_characters = sorted(selected_characters)
    
    # 역사 메타데이터 파일(historical_lifespans.json) 자동 생성/갱신
    global HISTORICAL_LIFESPANS
    chars_to_check = list(selected_characters)
    if target_char and target_char not in chars_to_check:
        chars_to_check.append(target_char)
    HISTORICAL_LIFESPANS = initialize_historical_lifespans_file(chars_to_check)
    
    # 만약 특정 캐릭터만 타겟팅했다면 리스트를 해당 캐릭터로 교체
    if target_char:
        if target_char not in selected_characters:
            print(f"[WARNING] '{target_char}'는 RAG 이야기 수가 60개 미만일 수 있습니다. 강제 생성을 시도합니다.")
            selected_characters = [target_char]
        else:
            selected_characters = [target_char]
            
    print(f"[INFO] 생성 대상 인물 리스트 ({len(selected_characters)}명): {selected_characters}")
    
    # 기존 characters.json 로드 (증분 업데이트용)
    character_database = {}
    if os.path.exists(CHARACTERS_JSON_PATH):
        try:
            with open(CHARACTERS_JSON_PATH, "r", encoding="utf-8") as f:
                character_database = json.load(f)
            print(f"[INFO] 기존에 {len(character_database)}명의 캐릭터 데이터가 로드되었습니다.")
        except Exception as e:
            print(f"[WARNING] 기존 JSON 로드 실패, 새로 생성합니다: {e}")
            
    start_time = time.time()
    

    for idx, char_name in enumerate(selected_characters):
        print(f"\n[{idx+1}/{len(selected_characters)}] '{char_name}' 처리 중...")
        
        db_char = character_database.get(char_name, {})
        associated_stories = get_associated_stories_for_char(df_clean, char_name)
        lifespan_info = HISTORICAL_LIFESPANS.get(char_name, {})
        
        # 국사 교과서 인메모리 RAG 데이터 조회 및 추가
        try:
            db_pkl_path = os.path.join(BASE_DIR, "data", "processed", "history_db.pkl")
            rag_instance = get_rag_instance(db_path=db_pkl_path)
            history_rag_results = rag_instance.retrieve(char_name, top_k=5, similarity_threshold=0.25)
            
            # RAG 검색 결과 평가 적재
            try:
                from rag_evaluator import RAGEvaluator
                evaluator = RAGEvaluator()
                evaluator.evaluate_retrieved_context(
                    character_name=char_name,
                    query=char_name,
                    retrieved_results=history_rag_results,
                    mode="offline"
                )
            except Exception as eval_err:
                print(f"  [WARNING] RAG 검색 결과 평가 실패: {eval_err}")

            for r_idx, r in enumerate(history_rag_results):
                associated_stories.append({
                    "id": 900000 + r_idx,
                    "title": f"국사 교과서 발췌 - {char_name}",
                    "summary": r["chunk"],
                    "domain": "국사교과서"
                })
            print(f"  [RAG] 국사 교과서에서 관련 팩트 {len(history_rag_results)}개 청크 병합 완료.")
        except Exception as e:
            print(f"  [WARNING] 국사 교과서 인메모리 RAG 로드/검색 실패: {e}")
        
        # RAG 단서를 도메인별 ID 리스트로 압축 가공 (Dict[str, List[int]])
        stories_dict = {}
        for s in associated_stories:
            domain = s.get("domain")
            story_id = s.get("id")
            if domain and story_id:
                if domain not in stories_dict:
                    stories_dict[domain] = []
                stories_dict[domain].append(story_id)
        
        # Determine execution flags for text generation steps
        curr_run_profile_text = False
        curr_run_scenario_text = False
        curr_run_turn1_text = False
        curr_run_turn2_text = False
        curr_run_turn3_text = False
        
        if norm_mode == "all":
            needs_profile = "mbti" not in db_char or not db_char.get("scenarios")
            if lifespan_info and db_char.get("years") != lifespan_info.get("years"):
                needs_profile = True
            if not needs_profile:
                scenarios = db_char.get("scenarios", [])
                if not scenarios:
                    needs_profile = True
                else:
                    first_scenario = scenarios[0]
                    turns = first_scenario.get("turns", [])
                    if not turns:
                        needs_profile = True
            if needs_profile:
                curr_run_profile_text = True
                curr_run_scenario_text = True
                curr_run_turn1_text = True
                curr_run_turn2_text = True
                curr_run_turn3_text = True
        elif norm_mode == "profiles-text":
            curr_run_profile_text = True
        elif norm_mode == "scenarios-text":
            curr_run_scenario_text = True
        elif norm_mode == "turns-text":
            curr_run_turn1_text = True
            curr_run_turn2_text = True
            curr_run_turn3_text = True
        elif norm_mode == "turn1-text":
            curr_run_turn1_text = True
        elif norm_mode == "turn2-text":
            curr_run_turn2_text = True
        elif norm_mode == "turn3-text":
            curr_run_turn3_text = True
            
        # 1-1. 프로필 텍스트 생성
        if curr_run_profile_text:
            print(f" ➔ '{char_name}' 프로필 텍스트 생성 진행...")
            success = False
            for attempt in range(3):
                try:
                    profile_data = generate_character_profile_via_openai(char_name, associated_stories)
                    db_char["name"] = profile_data.get("name", char_name)
                    db_char["category"] = profile_data.get("category")
                    db_char["era"] = lifespan_info.get("era", profile_data.get("era"))
                    db_char["era_tag"] = lifespan_info.get("era_tag", profile_data.get("era_tag"))
                    db_char["role"] = profile_data.get("role")
                    db_char["keywords"] = profile_data.get("keywords")
                    db_char["years"] = lifespan_info.get("years", profile_data.get("years"))
                    db_char["situation"] = profile_data.get("situation")
                    db_char["one_line_summary"] = profile_data.get("one_line_summary")
                    db_char["mbti"] = profile_data.get("mbti")
                    db_char["mbti_nickname"] = profile_data.get("mbti_nickname")
                    db_char["mbti_details"] = profile_data.get("mbti_details")
                    db_char["stats"] = profile_data.get("stats")
                    db_char["intro_quote"] = profile_data.get("intro_quote")
                    db_char["intro_desc"] = profile_data.get("intro_desc")
                    db_char["associated_stories"] = stories_dict
                    
                    if "image_url" not in db_char:
                        db_char["image_url"] = ""
                    if "scenarios" not in db_char:
                        db_char["scenarios"] = []
                        
                    success = True
                    print(f"  [SUCCESS] '{char_name}' 프로필 텍스트 생성 완료")
                    break
                except Exception as e:
                    print(f"  [WARNING] 프로필 텍스트 생성 시도 {attempt+1} 실패: {e}")
                    time.sleep(5)
            if not success:
                print(f"  [CRITICAL] '{char_name}' 프로필 텍스트 파이프라인 최종 실패.")
                
        # 1-2. 시나리오 테마 텍스트 생성
        if curr_run_scenario_text:
            print(f" ➔ '{char_name}' 시나리오 테마 텍스트 생성 진행...")
            success = False
            for attempt in range(3):
                try:
                    scenarios = generate_scenario_themes(char_name, associated_stories)
                    
                    # Ensure scenario_id is an integer and basic schema structure
                    for s_idx, scenario in enumerate(scenarios, 1):
                        scenario["scenario_id"] = int(scenario.get("scenario_id", s_idx))
                        if "scenario_image_url" in scenario:
                            del scenario["scenario_image_url"]
                        if "turns" in scenario:
                            del scenario["turns"]
                            
                    db_char["scenarios"] = scenarios
                    if "name" not in db_char:
                        db_char["name"] = char_name
                    if "image_url" not in db_char:
                        db_char["image_url"] = ""
                    db_char["associated_stories"] = stories_dict
                    
                    success = True
                    print(f"  [SUCCESS] '{char_name}' 시나리오 테마 텍스트 생성 완료")
                    break
                except Exception as e:
                    print(f"  [WARNING] 시나리오 테마 생성 시도 {attempt+1} 실패: {e}")
                    time.sleep(5)
            if not success:
                print(f"  [CRITICAL] '{char_name}' 시나리오 테마 텍스트 파이프라인 최종 실패.")
                
        # 1-3. 시나리오 턴 텍스트 생성
        if curr_run_turn1_text or curr_run_turn2_text or curr_run_turn3_text:
            print(f" ➔ '{char_name}' 시나리오 턴 텍스트 생성 진행...")
            scenarios = db_char.get("scenarios", [])
            if not scenarios:
                print(f"  [WARNING] 기존 시나리오 테마가 없습니다. 먼저 테마를 생성합니다...")
                success = False
                for attempt in range(3):
                    try:
                        scenarios = generate_scenario_themes(char_name, associated_stories)
                        success = True
                        break
                    except Exception as e:
                        print(f"  [WARNING] 시나리오 테마 생성 시도 {attempt+1} 실패: {e}")
                        time.sleep(5)
                if not success or not scenarios:
                    print(f"  [CRITICAL] '{char_name}' 시나리오 테마가 없어 턴 생성을 진행할 수 없습니다.")
                    scenarios = []

            if scenarios:
                category = db_char.get("category", "")
                if not category:
                    category = character_database.get(char_name, {}).get("category", "정치 / 외교")
                
                updated_scenarios = []
                for scenario in scenarios:
                    s_id = scenario.get("scenario_id", 1)
                    s_title = scenario.get("title", "")
                    s_desc = scenario.get("description", "")
                    s_facts = scenario.get("historical_facts", "")
                    
                    turns = scenario.get("turns", [])
                    if not isinstance(turns, list):
                        turns = []
                    
                    turns_map = {
                        _turn_sort_order(t): t
                        for t in turns
                        if isinstance(t, dict) and ("sort_order" in t or "turn_no" in t)
                    }
                    
                    # 1턴 생성/갱신
                    if curr_run_turn1_text:
                        print(f"   ➔ 시나리오 {s_id} ('{s_title}') Turn 1 텍스트 생성 중...")
                        success = False
                        for attempt in range(3):
                            try:
                                t1 = generate_turn1_for_scenario(char_name, s_title, s_desc, s_facts, category)
                                turns_map[0] = t1
                                success = True
                                print(f"    [SUCCESS] 시나리오 {s_id} Turn 1 텍스트 생성 완료")
                                break
                            except Exception as e:
                                print(f"    [WARNING] 시나리오 {s_id} Turn 1 생성 시도 {attempt+1} 실패: {e}")
                                time.sleep(5)
                        if not success:
                            print(f"    [ERROR] 시나리오 {s_id} Turn 1 텍스트 생성 최종 실패.")
                    
                    # 2턴 생성/갱신
                    if curr_run_turn2_text:
                        t1 = turns_map.get(0)
                        if not t1:
                            print(f"    [WARNING] Turn 1 데이터가 없습니다. 먼저 Turn 1을 임시 생성합니다...")
                            try:
                                t1 = generate_turn1_for_scenario(char_name, s_title, s_desc, s_facts, category)
                                turns_map[0] = t1
                            except Exception as e:
                                print(f"    [ERROR] Turn 1 임시 생성 실패: {e}")
                                t1 = {}
                        
                        if t1:
                            print(f"   ➔ 시나리오 {s_id} ('{s_title}') Turn 2 텍스트 생성 중...")
                            success = False
                            for attempt in range(3):
                                try:
                                    t2 = generate_turn2_for_scenario(char_name, s_title, s_desc, s_facts, category, t1)
                                    turns_map[1] = t2
                                    success = True
                                    print(f"    [SUCCESS] 시나리오 {s_id} Turn 2 텍스트 생성 완료")
                                    break
                                except Exception as e:
                                    print(f"    [WARNING] 시나리오 {s_id} Turn 2 생성 시도 {attempt+1} 실패: {e}")
                                    time.sleep(5)
                            if not success:
                                print(f"    [ERROR] 시나리오 {s_id} Turn 2 텍스트 생성 최종 실패.")
                        else:
                            print(f"    [ERROR] Turn 1 데이터가 없어 Turn 2를 생성할 수 없습니다.")
                            
                    # 3턴 생성/갱신
                    if curr_run_turn3_text:
                        t1 = turns_map.get(0)
                        t2 = turns_map.get(1)
                        if not t1 or not t2:
                            print(f"    [WARNING] Turn 1 또는 Turn 2 데이터가 없습니다. 순차 생성을 시도합니다...")
                            try:
                                if not t1:
                                    t1 = generate_turn1_for_scenario(char_name, s_title, s_desc, s_facts, category)
                                    turns_map[0] = t1
                                if not t2 and t1:
                                    t2 = generate_turn2_for_scenario(char_name, s_title, s_desc, s_facts, category, t1)
                                    turns_map[1] = t2
                            except Exception as e:
                                print(f"    [ERROR] 이전 턴 생성 실패: {e}")
                        
                        if t1 and t2:
                            print(f"   ➔ 시나리오 {s_id} ('{s_title}') Turn 3 텍스트 생성 중...")
                            success = False
                            for attempt in range(3):
                                try:
                                    t3 = generate_turn3_for_scenario(char_name, s_title, s_desc, s_facts, category, t1, t2)
                                    turns_map[2] = t3
                                    success = True
                                    print(f"    [SUCCESS] 시나리오 {s_id} Turn 3 텍스트 생성 완료")
                                    break
                                except Exception as e:
                                    print(f"    [WARNING] 시나리오 {s_id} Turn 3 생성 시도 {attempt+1} 실패: {e}")
                                    time.sleep(5)
                            if not success:
                                print(f"    [ERROR] 시나리오 {s_id} Turn 3 텍스트 생성 최종 실패.")
                        else:
                            print(f"    [ERROR] 이전 턴 데이터 부족으로 Turn 3를 생성할 수 없습니다.")
                    
                    # 정렬된 키 순서로 턴 리스트 구성
                    final_turns = []
                    for sort_order in sorted(turns_map.keys()):
                        final_turns.append(turns_map[sort_order])
                    
                    scenario["turns"] = final_turns
                    
                    # 선택지 밸런스 평가 적재
                    try:
                        from rag_evaluator import RAGEvaluator
                        evaluator = RAGEvaluator()
                        for turn_item in final_turns:
                            sort_order = _turn_sort_order(turn_item)
                            step_no = _turn_step_no(sort_order)
                            print(f"   ➔ 시나리오 {s_id} 턴 {step_no} 선택지 밸런스 평가 진행 중...")
                            evaluator.evaluate_choice_balance(
                                character_name=char_name,
                                scenario_title=s_title,
                                turn_data=turn_item
                            )
                    except Exception as eval_err:
                        print(f"    [WARNING] 선택지 밸런스 평가 중 오류: {eval_err}")

                    updated_scenarios.append(scenario)
                
                db_char["scenarios"] = updated_scenarios
                db_char["associated_stories"] = stories_dict

        # 마이그레이션: 기존 associated_stories가 list인 경우 dict로 변환
        old_stories = db_char.get("associated_stories", [])
        if isinstance(old_stories, list):
            db_char["associated_stories"] = stories_dict
        
        # 마이그레이션: 시나리오별 불필요한 scenario_image_url 제거 및 turn_image/choice_image 보장
        scenarios = db_char.get("scenarios", [])
        for scenario in scenarios:
            if "scenario_image_url" in scenario:
                del scenario["scenario_image_url"]
            for turn in scenario.get("turns", []):
                if "turn_image_url" in turn:
                    turn["turn_image"] = turn["turn_image_url"]
                    del turn["turn_image_url"]
                if "turn_image" not in turn:
                    turn["turn_image"] = ""
                if "tip_title" not in turn:
                    turn["tip_title"] = ""
                if "tip_desc" not in turn:
                    turn["tip_desc"] = ""
                if "title" not in turn:
                    turn["title"] = ""
                    
                choices = turn.get("choices", {})
                for choice_key, choice_val in choices.items():
                    if isinstance(choice_val, dict):
                        if "image_url" in choice_val:
                            choice_val["choice_image"] = choice_val["image_url"]
                            del choice_val["image_url"]
                        if "choice_image" not in choice_val:
                            choice_val["choice_image"] = ""
                        if "title" not in choice_val:
                            choice_val["title"] = choice_val.get("text", "")
                        if "description" not in choice_val:
                            choice_val["description"] = ""
                        if "turn_stats" not in choice_val:
                            choice_val["turn_stats"] = []
                        choice_val.pop("stats", None)
        
        # 키 순서 재배치 및 DB 갱신
        ordered_profile = {
            "name": db_char.get("name", char_name),
            "category": db_char.get("category", ""),
            "era": lifespan_info.get("era", db_char.get("era", "")),
            "era_tag": lifespan_info.get("era_tag", db_char.get("era_tag", "")),
            "role": db_char.get("role", ""),
            "keywords": db_char.get("keywords", []),
            "years": lifespan_info.get("years", db_char.get("years", "")),
            "image_url": db_char.get("image_url", ""),
            "situation": db_char.get("situation", ""),
            "one_line_summary": db_char.get("one_line_summary", ""),
            "mbti": db_char.get("mbti", ""),
            "mbti_nickname": db_char.get("mbti_nickname", ""),
            "mbti_details": db_char.get("mbti_details", {}),
            "stats": db_char.get("stats", []),
            "intro_quote": db_char.get("intro_quote", ""),
            "intro_desc": db_char.get("intro_desc", ""),
            "associated_stories": db_char.get("associated_stories", {}),
            "scenarios": scenarios
        }
        character_database[char_name] = ordered_profile
        db_char = character_database[char_name]
        
        # 즉시 저장
        with open(CHARACTERS_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(character_database, f, ensure_ascii=False, indent=4)
            
        # 1-4. 생성된 데이터 품질 평가 (RAG Evaluator)
        try:
            from rag_evaluator import RAGEvaluator
            evaluator = RAGEvaluator()
            
            # RAG 컨텍스트를 하나의 문자열로 결합
            rag_context_texts = [s.get('summary', '') for s in associated_stories if isinstance(s, dict)]
            # 국사교과서 RAG 결과도 추가
            for s in associated_stories:
                if isinstance(s, dict) and 'chunk' in s:
                    rag_context_texts.append(s['chunk'])
            rag_context_str = "\n".join([txt for txt in rag_context_texts if txt])
            
            # 평가 실행 및 로깅
            print(f" ➔ '{char_name}' 생성 데이터 품질 평가 진행 중...")
            eval_log = evaluator.evaluate_scenario_quality(
                character_name=char_name,
                rag_context=rag_context_str,
                generated_json=ordered_profile,
                mode="profile_and_scenario"
            )
            metrics = eval_log.get("metrics", {})
            print(f"  [EVAL] Facts: {metrics.get('facts_consistency')}/5, Glorification: {metrics.get('glorification_bias')}/5, Attribution: {metrics.get('actor_attribution')}/5, Era: {metrics.get('era_consistency')}/5, Story Flow: {metrics.get('story_flow_coherence')}/5")
        except Exception as eval_err:
            print(f"  [WARNING] 품질 평가 실행 중 오류 발생: {eval_err}")
            
        # 2. 캐릭터 전신 이미지 생성 (GCS)
        curr_run_profile_image = False
        if norm_mode == "all":
            curr_run_profile_image = not db_char.get("image_url") or not db_char["image_url"].startswith("http")
        elif norm_mode == "profiles-image":
            curr_run_profile_image = True
            
        if curr_run_profile_image:
            print(f" ➔ '{char_name}' 전신 이미지 생성 중...")
            img_url = generate_and_upload_character_image(char_name)
            if img_url:
                db_char["image_url"] = img_url
                character_database[char_name] = db_char
                with open(CHARACTERS_JSON_PATH, "w", encoding="utf-8") as f:
                    json.dump(character_database, f, ensure_ascii=False, indent=4)
                print(f"  [SUCCESS] 전신 이미지 업데이트 완료: {img_url}")
                time.sleep(5)
        else:
            print(f" ➔ '{char_name}' 전신 이미지 생성 스킵 (모드 제외 또는 이미 존재함)")
            
        # 3. 각 시나리오별 상황(턴) 및 선택지 이미지 생성 (GCS)
        curr_run_scenario_image = False
        curr_run_text_image = False
        target_turn_image_no = None
        
        if norm_mode == "all":
            curr_run_scenario_image = True
            curr_run_text_image = True
        elif norm_mode == "turns-image":
            curr_run_scenario_image = True
            curr_run_text_image = True
            
        if not curr_run_scenario_image and not curr_run_text_image:
            print(f" ➔ '{char_name}' 시나리오/선택지 이미지 생성을 생략합니다. (모드 제외)")
            continue
            
        scenarios = db_char.get("scenarios", [])
        for scenario in scenarios:
            s_id = scenario.get("scenario_id")
            s_title = scenario.get("title")
            
            for turn in scenario.get("turns", []):
                sort_order = _turn_sort_order(turn)
                step_no = _turn_step_no(sort_order)
                if target_turn_image_no is not None and step_no != target_turn_image_no:
                    continue
                t_situation = turn.get("situation", "")
                t_img = turn.get("turn_image", "")
                
                # 상황(턴) 이미지 생성 (16:9)
                if curr_run_scenario_image:
                    if not t_img or not t_img.startswith("http"):
                        print(f" ➔ 시나리오 {s_id} 턴 {step_no} 상황 이미지가 없습니다. 생성 중...")
                        t_img_url = generate_and_upload_turn_image(char_name, t_situation, s_id, sort_order)
                        if t_img_url:
                            turn["turn_image"] = t_img_url
                            character_database[char_name] = db_char
                            with open(CHARACTERS_JSON_PATH, "w", encoding="utf-8") as f:
                                json.dump(character_database, f, ensure_ascii=False, indent=4)
                            print(f"  [SUCCESS] 시나리오 {s_id} 턴 {step_no} 상황 이미지 업데이트 완료: {t_img_url}")
                            time.sleep(5)
                    else:
                        print(f" ➔ 시나리오 {s_id} 턴 {step_no} 상황 이미지 이미 존재함: {t_img}")
                
                # 선택지(A/B) 이미지 생성 (4:3 -> 1:1)
                if curr_run_text_image:
                    choices = turn.get("choices", {})
                    for choice_key in ["A", "B"]:
                        choice_val = choices.get(choice_key)
                        if not choice_val:
                            continue
                        
                        c_text = choice_val.get("title", "")
                        c_img = choice_val.get("choice_image", "")
                        
                        if not c_img or not c_img.startswith("http"):
                            print(f" ➔ 시나리오 {s_id} 턴 {step_no} 선택지 {choice_key} 이미지가 없습니다. 생성 중...")
                            c_img_url = generate_and_upload_choice_image(char_name, c_text, s_id, sort_order, choice_key)
                            if c_img_url:
                                choice_val["choice_image"] = c_img_url
                                character_database[char_name] = db_char
                                with open(CHARACTERS_JSON_PATH, "w", encoding="utf-8") as f:
                                    json.dump(character_database, f, ensure_ascii=False, indent=4)
                                print(f"  [SUCCESS] 시나리오 {s_id} 턴 {step_no} 선택지 {choice_key} 이미지 업데이트 완료: {c_img_url}")
                                time.sleep(5)
                        else:
                            print(f" ➔ 시나리오 {s_id} 턴 {step_no} 선택지 {choice_key} 이미지 이미 존재함: {c_img}")
                            
    end_time = time.time()
    print(f"\n[SUCCESS] 데이터 파이프라인 가동 완료. 저장 파일: {CHARACTERS_JSON_PATH}")
    print(f"총 소요 시간: {end_time - start_time:.2f}초")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        target = sys.argv[2] if len(sys.argv) > 2 else None
        
        mode = cmd.lstrip("-")
        
        run_main_pipeline(target, mode=mode)
    else:
        print("사용법:")
        print("  python scenario_generator.py --all [캐릭터명]             : 프로필 텍스트 및 모든 이미지(전신/상황/선택지) 일괄 생성 (특정 캐릭터 지정 가능)")
        print("  python scenario_generator.py --profiles-text [캐릭터명]   : 이미지 생성 없이 캐릭터 프로필 정보만 생성/갱신 (특정 캐릭터 지정 가능)")
        print("  python scenario_generator.py --scenarios-text [캐릭터명]  : 이미지 생성 없이 시나리오 메타데이터(테마) 정보만 생성 (특정 캐릭터 지정 가능)")
        print("  python scenario_generator.py --turns-text [캐릭터명]      : 시나리오 1, 2, 3턴 텍스트 정보만 순차 생성 (특정 캐릭터 지정 가능)")
        print("  python scenario_generator.py --endings-text [캐릭터명]    : 8가지 경우의 엔딩 스토리 텍스트 일괄 사전 생성 (캐릭터 지정 필수)")

        print("  python scenario_generator.py --profiles-image [캐릭터명]  : 캐릭터 전신 일러스트(프로필 카드용)만 생성 (특정 캐릭터 지정 가능)")
        print("  python scenario_generator.py --turns-image [캐릭터명]     : 시나리오 내 모든 턴 상황 및 선택지 이미지(GCS) 생성 (특정 캐릭터 지정 가능)")
        print("  python scenario_generator.py --endings-image [캐릭터명]   : 8가지 엔딩 일러스트(DALL-E) 일괄 사전 생성 (캐릭터 지정 필수)")
