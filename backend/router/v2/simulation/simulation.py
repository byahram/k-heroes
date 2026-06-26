import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from db.models import Character, Ending, PlaySession, Scenario, User
from repositories.simulation.content import (
    CharacterNotFoundError,
    EndingNotFoundError,
    ScenarioNotFoundError,
    build_choices_history,
    build_selected_choices,
    build_ending_markdown,
    compute_play_results,
    resolve_play_session_choices_history,
    get_character_card,
    get_ending_by_path,
    get_scenario_item,
    map_recommended_places,
    map_summary_items,
)
from db.database import get_db
from models.simulation.simulation import (
    ChoiceDetail,
    EndingRequest,
    EndingResponse,
    GameState,
    GameStateStat,
    StartRequest,
    StartResponse,
    TurnRequest,
    TurnResponse,
)
from repositories.scenario.turn_stats import map_turn_stats_to_effects, ordered_turn_stats_ids
from router.v2.deps import get_optional_current_user
from simulation_data_manager import get_recommended_places

router = APIRouter(prefix="/api/v2/simulation", tags=["Simulation v2"])


@router.post("/start", response_model=StartResponse)
async def start_simulation(payload: StartRequest, db: Session = Depends(get_db)):
    try:
        character_card = get_character_card(db, payload.character_name, scenario_id=payload.scenario_id)
    except CharacterNotFoundError:
        raise HTTPException(status_code=404, detail=f"Character '{payload.character_name}' not found.")
    except ScenarioNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    initial_stats = {
        f"stat_{i + 1}": GameStateStat(name=stat.name, value=stat.value)
        for i, stat in enumerate(character_card.turn_stats)
    }
    initial_state = GameState(
        character_name=payload.character_name,
        scenario_id=payload.scenario_id,
        history_score=0,
        current_step=1,
        game_stats=initial_stats,
        game_history=[],
        choices_path=[],
    )
    return StartResponse(character_card=character_card, initial_state=initial_state)


@router.post("/turn", response_model=TurnResponse)
async def play_turn(payload: TurnRequest, db: Session = Depends(get_db)):
    try:
        character_card = get_character_card(db, payload.character_name, scenario_id=payload.scenario_id)
        scenario = get_scenario_item(db, payload.character_name, payload.scenario_id)
    except CharacterNotFoundError:
        raise HTTPException(status_code=404, detail=f"Character '{payload.character_name}' not found.")
    except ScenarioNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    turn_stats_ids = ordered_turn_stats_ids(character_card.turn_stats)

    if payload.current_step < 1 or payload.current_step > len(scenario.turns):
        raise HTTPException(
            status_code=400,
            detail=f"유효하지 않은 단계: {payload.current_step} (총 {len(scenario.turns)}단계)",
        )

    turn_item = scenario.turns[payload.current_step - 1]
    choice_a_raw = turn_item.choices.get("A")
    choice_b_raw = turn_item.choices.get("B")
    if not choice_a_raw or not choice_b_raw:
        raise HTTPException(status_code=500, detail=f"Turn {payload.current_step} does not have both choices.")

    return TurnResponse(
        current_step=payload.current_step,
        total_steps=len(scenario.turns),
        step_label=f"STEP {payload.current_step}",
        title=turn_item.title,
        situation=turn_item.situation,
        toggle_question=turn_item.tip_title,
        toggle_answer=turn_item.tip_desc,
        choice_a=ChoiceDetail(
            is_historical=choice_a_raw.is_historical,
            title=choice_a_raw.title,
            description=choice_a_raw.description,
            stat_effects=map_turn_stats_to_effects(choice_a_raw.turn_stats, turn_stats_ids),
            choice_image=choice_a_raw.choice_image or "",
        ),
        choice_b=ChoiceDetail(
            is_historical=choice_b_raw.is_historical,
            title=choice_b_raw.title,
            description=choice_b_raw.description,
            stat_effects=map_turn_stats_to_effects(choice_b_raw.turn_stats, turn_stats_ids),
            choice_image=choice_b_raw.choice_image or "",
        ),
        turn_image=turn_item.turn_image or "",
    )


@router.post("/ending", response_model=EndingResponse)
async def generate_ending(
    payload: EndingRequest,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
):
    try:
        ending, scenario, character_card = get_ending_by_path(
            db, payload.character_name, payload.scenario_id, payload.choices_path
        )
    except CharacterNotFoundError:
        raise HTTPException(status_code=404, detail=f"Character '{payload.character_name}' not found.")
    except ScenarioNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except EndingNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    history_score, current_stats, _ = compute_play_results(
        scenario, character_card, payload.choices_path
    )

    summary_items = map_summary_items(ending.summary_items)
    recommended_places = map_recommended_places(ending.recommended_places)
    if not recommended_places:
        recommended_places = get_recommended_places(payload.character_name)

    ending_type = ending.ending_type
    title = ending.title
    history_fact = ending.history_fact
    story_headline = ending.story_headline.strip("\"'")
    story_contents = ending.story_contents
    factual_contents = ending.factual_contents or ""
    ending_image = ending.image_url or ""

    ending_markdown = build_ending_markdown(
        character_name=payload.character_name,
        choices_path=payload.choices_path,
        ending_type=ending_type,
        title=title,
        history_fact=history_fact,
        story_headline=story_headline,
        story_contents=story_contents,
        factual_contents=factual_contents,
        summary_items=summary_items,
        recommended_places=recommended_places,
        current_stats=current_stats,
        ending_image=ending_image,
    )

    scenario_row = db.get(Scenario, ending.scenario_id)

    choices_history = build_choices_history(scenario, payload.choices_path)

    result_id = str(uuid.uuid4())
    play_session = PlaySession(
        id=result_id,
        user_id=current_user.id if current_user else None,
        scenario_id=ending.scenario_id,
        ending_id=ending.id,
        status="completed",
        choices_path=payload.choices_path,
        choices_history=choices_history,
        history_score=history_score,
        final_stats=current_stats,
        character_name=payload.character_name,
        scenario_title=scenario_row.title if scenario_row else scenario.title,
        completed_at=datetime.now(timezone.utc),
    )
    db.add(play_session)
    db.commit()

    selected_choices = build_selected_choices(scenario, payload.choices_path)

    return EndingResponse(
        result_code="-".join(payload.choices_path),
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
        output_file_path="",
        uuid=result_id,
        final_stats=current_stats,
        choices_history=choices_history,
        character_name=payload.character_name,
        character_image=character_card.image_url,
        history_accuracy=history_score,
        selected_choices=selected_choices,
    )


def _play_session_to_response(session: PlaySession, ending: Ending, db: Session) -> EndingResponse:
    summary_items = map_summary_items(ending.summary_items)
    recommended_places = map_recommended_places(ending.recommended_places)
    if not recommended_places:
        recommended_places = get_recommended_places(session.character_name)

    ending_markdown = build_ending_markdown(
        character_name=session.character_name,
        choices_path=session.choices_path or [],
        ending_type=ending.ending_type,
        title=ending.title,
        history_fact=ending.history_fact,
        story_headline=ending.story_headline.strip("\"'"),
        story_contents=ending.story_contents,
        factual_contents=ending.factual_contents or "",
        summary_items=summary_items,
        recommended_places=recommended_places,
        current_stats=session.final_stats or {},
        ending_image=ending.image_url or "",
    )

    choices_history = resolve_play_session_choices_history(session)
    try:
        scenario_item = get_scenario_item(db, session.character_name, session.scenario_id)
        selected_choices = build_selected_choices(scenario_item, session.choices_path or [])
    except Exception:
        selected_choices = []

    character = db.scalar(
        select(Character)
        .where(
            Character.name == session.character_name,
            Character.is_active.is_(True),
            Character.deleted_at.is_(None),
        )
    )
    character_image = character.image_url if character else ""

    return EndingResponse(
        result_code="-".join(session.choices_path or []),
        ending_type=ending.ending_type,
        title=ending.title,
        history_fact=ending.history_fact,
        story_headline=ending.story_headline.strip("\"'"),
        story_contents=ending.story_contents,
        factual_contents=ending.factual_contents or "",
        summary_items=summary_items,
        recommended_places=recommended_places,
        ending_markdown=ending_markdown,
        ending_image=ending.image_url or "",
        output_file_path="",
        uuid=session.id,
        final_stats=session.final_stats,
        choices_history=choices_history,
        character_name=session.character_name,
        character_image=character_image,
        history_accuracy=session.history_score,
        selected_choices=selected_choices,
    )


@router.get("/result/{uuid}", response_model=EndingResponse)
async def get_simulation_result_api(uuid: str, db: Session = Depends(get_db)):
    session = db.scalar(
        select(PlaySession)
        .where(PlaySession.id == uuid)
        .options(
            selectinload(PlaySession.ending),
            selectinload(PlaySession.scenario),
        )
    )
    if not session:
        raise HTTPException(status_code=404, detail="해당 UUID의 시뮬레이션 결과를 찾을 수 없습니다.")

    ending = session.ending
    if not ending and session.ending_id:
        ending = db.get(Ending, session.ending_id)
    if not ending:
        raise HTTPException(status_code=404, detail="연결된 엔딩 데이터를 찾을 수 없습니다.")

    return _play_session_to_response(session, ending, db)
