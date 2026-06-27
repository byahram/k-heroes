import os
import json
import time
from fastapi import APIRouter, HTTPException
from typing import List, Dict, Optional, Any
from simulation_data_manager import (
    get_character_card,
    get_retrieved_clues,
    openai_client,
    save_simulation_result,
    get_simulation_result,
    get_recommended_places,
    get_pre_generated_ending
)
from repositories.scenario.turn_stats import map_turn_stats_to_effects, ordered_turn_stats_ids
import uuid
from models.character.character import CharacterCard
from rag_evaluator import RAGEvaluator

rag_evaluator = RAGEvaluator()
from models.simulation.simulation import (
    StartRequest,
    GameStateStat,
    GameState,
    StartResponse,
    ChoiceDetail,
    TurnRequest,
    TurnResponse,
    EndingRequest,
    EndingResponse,
    SummaryItem,
    RecommendedPlace
)

router = APIRouter(prefix="/api/simulation", tags=["Simulation"])

# --- API Endpoints ---
@router.post("/start", response_model=StartResponse)
async def start_simulation(payload: StartRequest):
    character_name = payload.character_name
    scenario_id = payload.scenario_id
    
    try:
        character_card = get_character_card(character_name)
        
        # Filter scenarios
        filtered_scenarios = [s for s in character_card.scenarios if s.id == scenario_id]
        if not filtered_scenarios:
            raise HTTPException(status_code=404, detail=f"시나리오 ID {scenario_id}를 인물 '{character_name}'에게서 찾을 수 없습니다.")
        character_card.scenarios = filtered_scenarios
        
        # 초기 스탯 딕셔너리 생성 (카드에 적힌 고유 수치로 초기화)
        initial_stats = {}
        for i, stat in enumerate(character_card.turn_stats):
            initial_stats[f"stat_{i+1}"] = GameStateStat(name=stat.name, value=stat.value)
            
        initial_state = GameState(
            character_name=character_name,
            scenario_id=scenario_id,
            history_score=0,
            current_step=1,
            game_stats=initial_stats,
            game_history=[],
            choices_path=[]
        )
        
        return StartResponse(character_card=character_card, initial_state=initial_state)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"시뮬레이션 시작 실패: {str(e)}")

@router.post("/turn", response_model=TurnResponse)
async def play_turn(payload: TurnRequest):
    character_name = payload.character_name
    scenario_id = payload.scenario_id
    current_step = payload.current_step
    
    try:
        character_card = get_character_card(character_name)
        
        # 1. Find the scenario matching scenario_id
        scenario = None
        for s in character_card.scenarios:
            if s.id == scenario_id:
                scenario = s
                break
        if not scenario:
            if character_card.scenarios:
                scenario = character_card.scenarios[0]
            else:
                raise ValueError(f"Character '{character_name}' does not have any scenarios.")
                
        # 2. Find the turn matching current_step (1-indexed)
        if current_step < 1 or current_step > len(scenario.turns):
            raise HTTPException(status_code=400, detail=f"유효하지 않은 단계: {current_step} (총 {len(scenario.turns)}단계)")
            
        turn_item = scenario.turns[current_step - 1]
        
        # 3. Construct ChoiceDetails and map stats
        choice_a_raw = turn_item.choices.get("A")
        choice_b_raw = turn_item.choices.get("B")
        
        if not choice_a_raw or not choice_b_raw:
            raise ValueError(f"Turn {current_step} does not have both Choice A and Choice B.")

        turn_stats_ids = ordered_turn_stats_ids(character_card.turn_stats)

        choice_a = ChoiceDetail(
            is_historical=choice_a_raw.is_historical,
            title=choice_a_raw.title,
            description=choice_a_raw.description,
            stat_effects=choice_a_raw.stats if choice_a_raw.stats else map_turn_stats_to_effects(choice_a_raw.turn_stats, stat_ids),
            choice_image=choice_a_raw.choice_image if getattr(choice_a_raw, "choice_image", None) else ""
        )

        choice_b = ChoiceDetail(
            is_historical=choice_b_raw.is_historical,
            title=choice_b_raw.title,
            description=choice_b_raw.description,
            stat_effects=choice_b_raw.stats if choice_b_raw.stats else map_turn_stats_to_effects(choice_b_raw.turn_stats, stat_ids),
            choice_image=choice_b_raw.choice_image if getattr(choice_b_raw, "choice_image", None) else ""
        )
        
        return TurnResponse(
            current_step=current_step,
            total_steps=len(scenario.turns),
            step_label=f"STEP {current_step}",
            title=turn_item.title,
            situation=turn_item.situation,
            toggle_question=turn_item.tip_title,
            toggle_answer=turn_item.tip_desc,
            choice_a=choice_a,
            choice_b=choice_b,
            turn_image=turn_item.turn_image if getattr(turn_item, "turn_image", None) else ""
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"시나리오 턴 정보 조회 실패: {str(e)}")

def get_history_rag_context(character_name: str, query: str, era_tag: Optional[str] = None) -> List[Dict[str, Any]]:
    try:
        from utils.history_pdf_rag_retriever import get_rag_instance
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        db_path = os.path.join(base_dir, "data", "processed", "history_db.pkl")
        rag = get_rag_instance(db_path)
        if rag:
            return rag.retrieve(
                f"{character_name} {query}",
                top_k=3,
                character_name=character_name,
                era_tag=era_tag
            )
    except Exception as e:
        print(f"[RAG] Error retrieving context: {e}")
    return []
    
@router.post("/ending", response_model=EndingResponse)
async def generate_ending(payload: EndingRequest):
    if not openai_client:
        raise HTTPException(status_code=500, detail="OpenAI API Client가 설정되지 않았습니다. (.env에 OPENAI_API_KEY를 확인하세요)")
        
    character_name = payload.character_name
    scenario_id = payload.scenario_id
    choices_path = payload.choices_path
    
    try:
        character_card = get_character_card(character_name)
        
        # 1. Find scenario
        scenario = None
        for s in character_card.scenarios:
            if s.id == scenario_id:
                scenario = s
                break
        if not scenario:
            if character_card.scenarios:
                scenario = character_card.scenarios[0]
            else:
                raise ValueError(f"Character '{character_name}' does not have any scenarios.")
                
        # 1.5. Calculate history_score, check historical choices, and compute final game_stats
        total_turns = len(scenario.turns)
        historical_choices_count = 0
        stat_lookup = {stat.id: stat for stat in character_card.turn_stats}
        current_by_id = {stat.id: stat.value for stat in character_card.turn_stats}

        for idx, turn in enumerate(scenario.turns):
            user_choice_id = choices_path[idx] if idx < len(choices_path) else "A"
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
                    
        history_score = int((historical_choices_count / total_turns) * 100) if total_turns > 0 else 100
        is_all_historical = (historical_choices_count == total_turns)
                
        # Check for pre-generated ending
        pre_ending = get_pre_generated_ending(character_name, scenario_id, choices_path)
        
        if pre_ending:
            print(f"[ENDING] Using pre-generated ending for {character_name} scenario {scenario_id} path: {'-'.join(choices_path)}")
            ending_type = pre_ending.get("ending_type", "Alternative Ending")
            title = pre_ending.get("title", "")
            history_fact = pre_ending.get("history_fact", "")
            story_headline = pre_ending.get("story_headline", "").strip('"\'')
            story_contents = pre_ending.get("story_contents", "")
            factual_contents = pre_ending.get("factual_contents", "")
            summary_items_raw = pre_ending.get("summary_items", [])
            summary_items = [
                SummaryItem(title=item.get("title", ""), desc=item.get("desc", ""))
                for item in summary_items_raw
            ]
            recommended_places_raw = pre_ending.get("recommended_places", [])
            if recommended_places_raw:
                recommended_places = [
                    RecommendedPlace(
                        address=item.get("address", ""),
                        name=item.get("name", ""),
                        description=item.get("desc", item.get("description", "")),
                        image_url=item.get("image_url", "")
                    )
                    for item in recommended_places_raw
                ]
            else:
                recommended_places = get_recommended_places(character_name)
            
            ending_image = pre_ending.get("image_url", "")
        else:
            print(f"[ENDING] Pre-generated ending not found. Falling back to real-time LLM...")
            # 2. Compile user and factual stories
            factual_story_parts = []
            user_story_parts = []
            
            for idx, turn in enumerate(scenario.turns):
                situation = turn.situation
                # User choice
                user_choice_id = choices_path[idx] if idx < len(choices_path) else "A"
                user_choice = turn.choices.get(user_choice_id)
                if not user_choice:
                    user_choice = list(turn.choices.values())[0]
                    
                # Historical choice
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
            
            # 3. Retrieve PDF RAG context (Metadata-aware retrieval with RRF)
            start_rag_time = time.time()
            rag_results = get_history_rag_context(character_name, scenario.title, character_card.era_tag)
            rag_latency_ms = (time.time() - start_rag_time) * 1000
            
            # RAG 검색 결과 평가 적재 (런타임이므로 샘플링 적용)
            try:
                rag_evaluator.evaluate_retrieved_context(
                    character_name=character_name,
                    query=f"{character_name} {scenario.title}",
                    retrieved_results=rag_results,
                    mode="online",
                    sampling_rate=0.10,
                    force_eval=payload.force_eval
                )
            except Exception as eval_err:
                print(f"[RAG EVAL] Error in evaluate_retrieved_context: {eval_err}")
            
            # Format context string for the LLM prompt
            rag_context = ""
            if rag_results:
                rag_context = "\n".join([f"- {r['chunk']} (유사도: {r['score']:.2f})" for r in rag_results])
            
            # 4. Core and retrieved clues context
            other_clues = get_retrieved_clues(character_name)
            
            context_str = "[기타 인물 행적 배경 단서]\n"
            for clue in other_clues[:5]:
                context_str += f"- {clue['text']}\n"
            if rag_context:
                context_str += f"\n[국사 교과서 RAG 단서]\n{rag_context}\n"
                
            # 5. Format stats
            stats_str = {name: f"{val}%" for name, val in current_stats.items()}
            
            # 7. Prompt for OpenAI to generate narrative
            ending_prompt = f"""
너는 역사 시뮬레이션 게임 'K-Heroes'의 최종 엔딩 연출가야.
유저가 게임 도중 내린 선택과 그로 인해 발생한 이야기를 토대로 최종 감동적인 엔딩과 실제 역사와의 비교를 작성해 줘.

[대상 인물]
이름: {character_name}

[시나리오]
제목: {scenario.title}
역사적 사실 요약: {scenario.historical_facts}

[국사교과서 및 RAG 역사 단서]
{context_str}

[유저의 플레이 기록]
- 유저의 선택 경로: {choices_path} (역사 점수: {history_score}/100점)
- 플레이어 능력치 상태: {stats_str}

[스토리 소스 (characters.json 기준)]
1. 유저가 만든 역사 이야기 흐름:
{user_compiled_story}

2. 실제 역사 이야기 흐름:
{factual_compiled_story}

# 제작 가이드라인 & 할루시네이션 절대 금지
1. 실제 역사적 사실과의 비교 (history_fact):
   - 제공된 역사 단서와 실제 역사 이야기 흐름을 바탕으로, 유저의 선택이 실제 역사와 어떻게 다르고 어떤 교훈이 있는지 정확하고 상세히(3-4줄) 서술해 주세요.
2. 엔딩 유형 (ending_type):
   - 역사 점수가 100점인 경우 또는 모든 선택이 역사적 선택인 경우: "True Ending"
   - 그 외의 경우: "Alternative Ending"
3. 엔딩 타이틀 (title):
   - 유저의 엔딩 흐름에 맞는 감동적이고 웅장한 타이틀을 지어주세요.
4. 결과 스토리:
   - story_headline: 효과음이나 대사로 시작하는 강렬한 헤드라인 1줄 (따옴표 포함)
   - story_contents: 유저의 선택들이 만들어낸 서사 결과를 초등학생 눈높이에 맞게 쉽고 웅장한 톤으로 2-3줄 요약해 주세요.
   - factual_contents: 실제 역사 이야기 흐름을 정돈하여, 역사 속 인물이 겪은 실제 결말을 2-3줄 요약해 주세요.
5. 결과 요약 (summary_items):
   - 이번 시나리오의 핵심 교훈이나 유저의 활약을 3개의 요약 항목 리스트(각각 title과 desc로 구성된 객체)로 작성해 주세요.
6. 초등학생 눈높이에 맞게 쉽고 감동적인 톤을 유지하세요.

반드시 아래 JSON 형식으로 응답할 것:
{{
    "ending_type": "True Ending" 또는 "Alternative Ending",
    "title": "엔딩 타이틀",
    "history_fact": "실제 역사와 비교 및 교훈 해설",
    "story_headline": "강렬한 헤드라인 1줄 (예: \\"轟-!!! 폭음 뒤에 숨겨진 자유의 외침!\\")",
    "story_contents": "유저 선택 기반의 서사 결과 2-3줄",
    "factual_contents": "실제 역사 기반의 서사 결과 2-3줄",
    "summary_items": [
        {{"title": "요약 제목 1", "desc": "요약 설명 1"}},
        {{"title": "요약 제목 2", "desc": "요약 설명 2"}},
        {{"title": "요약 제목 3", "desc": "요약 설명 3"}}
    ]
}}
"""
            max_retries = 3
            ending_result = None
            for attempt in range(max_retries):
                try:
                    response = openai_client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=[
                            {"role": "user", "content": ending_prompt}
                        ],
                        response_format={"type": "json_object"}
                    )
                    ending_result = response.choices[0].message.content
                    break
                except Exception as e:
                    err_msg = str(e)
                    if "429" in err_msg or "rate_limit" in err_msg.lower() or "rate limit" in err_msg.lower() or "RateLimitError" in type(e).__name__:
                        if attempt < max_retries - 1:
                            wait_sec = 25 * (attempt + 1)
                            print(f"\n[WARNING] OpenAI 429 Rate Limit 감지 (generate_ending). {wait_sec}초 대기 후 재시도합니다... (시도 {attempt+1}/{max_retries})")
                            time.sleep(wait_sec)
                            continue
                    raise e
            if not ending_result:
                raise Exception("API 응답 데이터를 수신하지 못했습니다.")

            ending_data = json.loads(ending_result)
            
            # Log and evaluate RAG context continuously
            try:
                rag_evaluator.evaluate_and_log(
                    character_name=character_name,
                    era_tag=character_card.era_tag,
                    query=f"{character_name} {scenario.title}",
                    retrieved_results=rag_results,
                    generated_ending=ending_data,
                    latency_ms=rag_latency_ms,
                    force_llm_eval=payload.force_eval
                )
            except Exception as eval_err:
                print(f"[RAG EVAL] Error in evaluate_and_log: {eval_err}")

            ending_type = "True Ending" if (is_all_historical or history_score >= 100) else "Alternative Ending"
            title = ending_data.get("title", "")
            history_fact = ending_data.get("history_fact", "")
            story_headline = ending_data.get("story_headline", "").strip('"\'')
            story_contents = ending_data.get("story_contents", "")
            factual_contents = ending_data.get("factual_contents", "")
            summary_items_raw = ending_data.get("summary_items", [])

            summary_items = [
                SummaryItem(title=item.get("title", ""), desc=item.get("desc", ""))
                for item in summary_items_raw
            ]
            recommended_places = get_recommended_places(character_name)
            ending_image = ""

        # 9. Format Markdown output
        emoji = "🔴" if ending_type == "True Ending" else "🔵"
        stats_formatted = [f"{name}: {val}%" for name, val in current_stats.items()]
        stats_joined = ", ".join(stats_formatted)

        ending_markdown = f"""### 3. 최종 결과

#### RESULT. [유저의 선택조합: {'-'.join(choices_path)}]
**[상단 타이틀 및 캐릭터 연출]**
- **엔딩 타이틀:** {emoji} {title} ({ending_type})
- **최종 능력치 결과:** {stats_joined}

**[실제 역사적 사실과 비교]**
- **💡 이 엔딩은 실제 역사와 어떤 차이가 있을까요?**
- {history_fact}

**[결과 스토리 및 요약]**
- **📖 내가 만든 역사이야기 (Story)**
  - **"{story_headline}"**
  - {story_contents}

- **🏛️ 실제 역사이야기 (Factual Story)**
  - {factual_contents}

- **📌 결과 요약 (Summary)**
"""
        for i, item in enumerate(summary_items):
            ending_markdown += f"  - {i+1}. {item.title}: {item.desc}\n"

        ending_markdown += f"\n#### 추천 방문지\n- 💡 {character_name}을(를) 좀 더 알아보고 싶으세요?\n"
        for place in recommended_places:
            ending_markdown += f"- **{place.name}** ({place.address}): {place.description}\n"
            if place.image_url:
                ending_markdown += f"  ![{place.name}]({place.image_url})\n"

        if ending_image:
            ending_markdown += f"\n#### 일러스트\n![엔딩 일러스트]({ending_image})\n"

        ending_markdown += f"""
#### Floating Button
- **공유하기:** "내가 만든 역사 엔딩을 친구에게 공유해보세요! 🔗"
- **다음 인물 체험하기**
"""

        # 10. Save result to GCS / Local fallback
        result_id = str(uuid.uuid4())
        result_dict = {
            "result_code": "-".join(choices_path),
            "ending_type": ending_type,
            "title": title,
            "history_fact": history_fact,
            "story_headline": story_headline,
            "story_contents": story_contents,
            "factual_contents": factual_contents,
            "summary_items": [item.dict() for item in summary_items],
            "recommended_places": [place.dict() for place in recommended_places],
            "ending_markdown": ending_markdown,
            "ending_image": ending_image,
            "output_file_path": "",
            "uuid": result_id
        }
        
        output_file_path = save_simulation_result(result_id, character_name, scenario_id, result_dict)

        return EndingResponse(
            result_code="-".join(choices_path),
            ending_type=ending_type,
            title=title,
            history_fact=history_fact,
            story_headline=story_headline,
            story_contents=story_contents,
            factual_contents=factual_contents,
            summary_items=summary_items,
            recommended_places=recommended_places,
            ending_markdown=ending_markdown,
            ending_image=ending_image,
            output_file_path=output_file_path,
            uuid=result_id
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"엔딩 생성 실패: {str(e)}")

@router.get("/result/{uuid}", response_model=EndingResponse)
async def get_simulation_result_api(uuid: str):
    try:
        result_dict = get_simulation_result(uuid)
        if not result_dict:
            raise HTTPException(status_code=404, detail="해당 UUID의 시뮬레이션 결과를 찾을 수 없습니다.")
            
        return EndingResponse(**result_dict)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"시뮬레이션 결과 조회 실패: {str(e)}")

@router.get("/rag/metrics")
async def get_rag_metrics(limit: int = 100):
    try:
        from rag_evaluator import get_rag_statistics
        stats = get_rag_statistics(limit=limit)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG 지표 조회 실패: {str(e)}")
