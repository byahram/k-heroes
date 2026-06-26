from __future__ import annotations

from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from db.models import Character, CharacterCategory, Choice, Ending, PlaySession, Scenario, Turn
from models.character.character import (
    CharacterCard,
    ChoiceItem,
    ChoiceTurnStatItem,
    MBTIDetails,
    ScenarioItem,
    StatItem,
    TurnItem,
    TurnStatGameItem,
)
from models.simulation.simulation import RecommendedPlace, SummaryItem, SelectedChoiceDetail
from repositories.character.character_stats import stat_items_from_json
from repositories.character.character_turn_stats import active_turn_stats
from repositories.scenario.turn_stats import DEFAULT_GAME_STAT_VALUE


class CharacterNotFoundError(Exception):
    pass


class ScenarioNotFoundError(Exception):
    pass


class EndingNotFoundError(Exception):
    pass


def _is_active_character(char: Character) -> bool:
    return char.is_active and char.deleted_at is None


def _is_active_scenario(scenario: Scenario) -> bool:
    return scenario.is_active and scenario.deleted_at is None


def _is_visible_turn(turn: Turn) -> bool:
    return turn.is_active and turn.deleted_at is None


def _is_visible_choice(choice: Choice) -> bool:
    return choice.deleted_at is None


def _is_visible_ending(ending: Ending) -> bool:
    return ending.is_active and ending.deleted_at is None


def _map_choice(choice: Choice) -> ChoiceItem:
    return ChoiceItem(
        title=choice.title,
        description=choice.description,
        choice_image=choice.choice_image or "",
        turn_stats=[
            ChoiceTurnStatItem(
                turn_stats_id=item["turn_stats_id"],
                delta=item["delta"],
            )
            for item in (choice.turn_stats or [])
        ],
        result_text=choice.result_text,
        is_historical=choice.is_historical,
    )


def _map_turn(turn: Turn) -> TurnItem:
    choices = {
        choice.choice_key: _map_choice(choice)
        for choice in turn.choices
        if _is_visible_choice(choice)
    }
    return TurnItem(
        sort_order=turn.sort_order,
        title=turn.title,
        situation=turn.situation,
        turn_image=turn.turn_image or "",
        tip_title=turn.tip_title,
        tip_desc=turn.tip_desc,
        choices=choices,
    )


def _map_scenario(scenario: Scenario) -> ScenarioItem:
    turns = [_map_turn(turn) for turn in scenario.turns if _is_visible_turn(turn)]
    turns.sort(key=lambda t: t.sort_order)
    first_turn_image = turns[0].turn_image if turns else ""
    return ScenarioItem(
        id=scenario.id,
        sort_order=scenario.sort_order,
        title=scenario.title,
        description=scenario.description,
        historical_facts=scenario.historical_facts,
        source_story_ids=scenario.source_story_ids or [],
        turns=turns,
        image_url=first_turn_image,
    )


def _map_character(
    character: Character,
    *,
    include_scenarios: bool = True,
    scenario_id: Optional[int] = None,
    lightweight: bool = False,
) -> CharacterCard:
    stats = stat_items_from_json(character.stats)
    turn_stats = [
        TurnStatGameItem(id=row.id, name=row.name, value=DEFAULT_GAME_STAT_VALUE)
        for row in active_turn_stats(character)
    ]

    scenarios: List[ScenarioItem] = []
    if include_scenarios and not lightweight:
        active_scenarios = [s for s in character.scenarios if _is_active_scenario(s)]
        active_scenarios.sort(key=lambda s: (s.sort_order, s.id))
        for scenario in active_scenarios:
            if scenario_id is not None and scenario.id != scenario_id:
                continue
            scenarios.append(_map_scenario(scenario))

    return CharacterCard(
        id=character.id,
        name=character.name,
        category=character.category,
        era=character.era,
        era_tag=character.era_tag,
        role=character.role,
        keywords=character.keywords or [],
        years=character.years,
        image_url=character.image_url or "",
        situation=character.situation,
        one_line_summary=character.one_line_summary,
        mbti=character.mbti,
        mbti_nickname=character.mbti_nickname,
        mbti_details=MBTIDetails(
            E_I=character.mbti_e_i,
            S_N=character.mbti_s_n,
            T_F=character.mbti_t_f,
            J_P=character.mbti_j_p,
        ),
        stats=stats,
        turn_stats=turn_stats,
        intro_quote=character.intro_quote,
        intro_desc=character.intro_desc,
        associated_stories={} if lightweight else (character.associated_stories or {}),
        scenarios=scenarios,
    )


def _character_query(*, active_category_only: bool = True):
    query = (
        select(Character)
        .join(Character.character_category)
        .where(Character.is_active.is_(True), Character.deleted_at.is_(None))
        .options(
            selectinload(Character.character_category),
            selectinload(Character.turn_stats),
            selectinload(Character.scenarios)
            .selectinload(Scenario.turns)
            .selectinload(Turn.choices),
        )
    )
    if active_category_only:
        query = query.where(
            CharacterCategory.is_active.is_(True),
            CharacterCategory.deleted_at.is_(None),
        )
    return query


def _character_list_order():
    return (CharacterCategory.sort_order, Character.sort_order, Character.name)


def list_characters(db: Session, category_id: Optional[int] = None) -> List[CharacterCard]:
    query = _character_query().order_by(*_character_list_order())
    if category_id is not None:
        query = query.where(Character.category_id == category_id)
    characters = db.scalars(query).all()
    return [_map_character(character, lightweight=True) for character in characters]


def get_character_card(
    db: Session,
    name: str,
    *,
    scenario_id: Optional[int] = None,
) -> CharacterCard:
    character = db.scalar(_character_query().where(Character.name == name))
    if not character:
        raise CharacterNotFoundError(f"Character '{name}' not found.")
    return _get_character_card_from_row(character, scenario_id=scenario_id)


def get_character_card_by_id(
    db: Session,
    character_id: int,
    *,
    scenario_id: Optional[int] = None,
) -> CharacterCard:
    character = db.scalar(_character_query().where(Character.id == character_id))
    if not character:
        raise CharacterNotFoundError(f"Character id={character_id} not found.")
    return _get_character_card_from_row(character, scenario_id=scenario_id)


def _get_character_card_from_row(
    character: Character,
    *,
    scenario_id: Optional[int] = None,
) -> CharacterCard:
    card = _map_character(character, scenario_id=scenario_id)
    if scenario_id is not None and not card.scenarios:
        raise ScenarioNotFoundError(
            f"시나리오 ID {scenario_id}를 인물 '{character.name}'에게서 찾을 수 없습니다."
        )
    return card


def get_scenario_item(db: Session, name: str, scenario_id: int) -> ScenarioItem:
    card = get_character_card(db, name, scenario_id=scenario_id)
    if not card.scenarios:
        raise ScenarioNotFoundError(
            f"시나리오 ID {scenario_id}를 인물 '{name}'에게서 찾을 수 없습니다."
        )
    return card.scenarios[0]


def get_ending_by_path(
    db: Session,
    name: str,
    scenario_id: int,
    choices_path: List[str],
) -> tuple[Ending, ScenarioItem, CharacterCard]:
    character = db.scalar(
        select(Character)
        .where(
            Character.name == name,
            Character.is_active.is_(True),
            Character.deleted_at.is_(None),
        )
    )
    if not character:
        raise CharacterNotFoundError(f"Character '{name}' not found.")

    scenario = db.scalar(
        select(Scenario).where(
            Scenario.id == scenario_id,
            Scenario.character_id == character.id,
            Scenario.is_active.is_(True),
            Scenario.deleted_at.is_(None),
        )
    )
    if not scenario:
        raise ScenarioNotFoundError(
            f"시나리오 ID {scenario_id}를 인물 '{name}'에게서 찾을 수 없습니다."
        )

    path_key = "-".join(choices_path)
    ending = db.scalar(
        select(Ending).where(
            Ending.scenario_id == scenario.id,
            Ending.path_key == path_key,
            Ending.deleted_at.is_(None),
        )
    )
    if not ending:
        raise EndingNotFoundError(
            f"엔딩을 찾을 수 없습니다: {name} / scenario {scenario_id} / {path_key}"
        )

    scenario_item = get_scenario_item(db, name, scenario_id)
    character_card = _map_character(character, scenario_id=scenario_id)
    return ending, scenario_item, character_card


def map_summary_items(raw: list) -> List[SummaryItem]:
    return [
        SummaryItem(title=item.get("title", ""), desc=item.get("desc", ""))
        for item in (raw or [])
    ]


def map_recommended_places(raw: list) -> List[RecommendedPlace]:
    return [
        RecommendedPlace(
            address=item.get("address", ""),
            name=item.get("name", ""),
            description=item.get("description", ""),
            link=item.get("link", "") or "",
            image_url=item.get("image_url", "") or "",
        )
        for item in (raw or [])
    ]


def build_choices_history(scenario: ScenarioItem, choices_path: List[str]) -> List[bool]:
    history: List[bool] = []
    for idx, turn in enumerate(scenario.turns):
        if idx >= len(choices_path):
            break
        user_choice_key = choices_path[idx]
        user_choice = turn.choices.get(user_choice_key)
        if not user_choice:
            user_choice = next(iter(turn.choices.values()), None)
        history.append(user_choice.is_historical if user_choice else False)
    return history


def build_selected_choices(scenario: ScenarioItem, choices_path: List[str]) -> List[SelectedChoiceDetail]:
    selected: List[SelectedChoiceDetail] = []
    for idx, turn in enumerate(scenario.turns):
        if idx >= len(choices_path):
            break
        user_choice_key = choices_path[idx]
        user_choice = turn.choices.get(user_choice_key)
        if not user_choice:
            user_choice = next(iter(turn.choices.values()), None)
        if user_choice:
            selected.append(
                SelectedChoiceDetail(
                    turn_no=turn.sort_order,
                    turn_title=turn.title,
                    choice_key=user_choice_key,
                    title=user_choice.title,
                    is_historical=user_choice.is_historical,
                    image_url=user_choice.choice_image or turn.turn_image or "",
                )
            )
    return selected


def resolve_play_session_choices_history(session: PlaySession) -> List[bool]:
    return list(session.choices_history or [])


def compute_play_results(
    scenario: ScenarioItem,
    character_card: CharacterCard,
    choices_path: List[str],
) -> tuple[int, Dict[str, int], int]:
    total_turns = len(scenario.turns)
    historical_choices_count = 0
    stat_lookup = {stat.id: stat for stat in character_card.turn_stats}
    current_by_id = {stat.id: stat.value for stat in character_card.turn_stats}

    for idx, turn in enumerate(scenario.turns):
        user_choice_id = choices_path[idx] if idx < len(choices_path) else "A"
        user_choice = turn.choices.get(user_choice_id)
        if not user_choice:
            user_choice = next(iter(turn.choices.values()))

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

    history_score = (
        int((historical_choices_count / total_turns) * 100) if total_turns > 0 else 100
    )
    return history_score, current_stats, historical_choices_count


def build_ending_markdown(
    *,
    character_name: str,
    choices_path: List[str],
    ending_type: str,
    title: str,
    history_fact: str,
    story_headline: str,
    story_contents: str,
    factual_contents: str,
    summary_items: List[SummaryItem],
    recommended_places: List[RecommendedPlace],
    current_stats: Dict[str, int],
    ending_image: str = "",
) -> str:
    emoji = "🔴" if ending_type == "True Ending" else "🔵"
    stats_joined = ", ".join(f"{name}: {val}%" for name, val in current_stats.items())

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

    ending_markdown += """
#### Floating Button
- **공유하기:** "내가 만든 역사 엔딩을 친구에게 공유해보세요! 🔗"
- **다음 인물 체험하기**
"""
    return ending_markdown
