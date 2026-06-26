import pytest
from sqlalchemy import select

from core.security import hash_password
from db.models import AuthProvider, PlaySession, Scenario, User, UserGrade
from tests.helpers import get_scenario


@pytest.fixture
def yi_scenario_id(db_session):
    scenario = get_scenario(db_session, "이순신", 0)
    assert scenario is not None
    return scenario.id


def seed_local_user(db_session, login_id: str = "userone", password: str = "user-secret") -> User:
    user = User(
        auth_provider=AuthProvider.LOCAL,
        login_id=login_id,
        name="회원1",
        email="userone@example.com",
        password_hash=hash_password(password),
        nickname="회원1",
        grade=UserGrade.STUDENT,
    )
    db_session.add(user)
    db_session.flush()
    return user


def test_start_simulation(client, yi_scenario_id):
    response = client.post(
        "/api/v2/simulation/start",
        json={"character_name": "이순신", "scenario_id": yi_scenario_id},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["initial_state"]["character_name"] == "이순신"
    assert data["initial_state"]["scenario_id"] == yi_scenario_id
    assert data["initial_state"]["current_step"] == 1
    assert len(data["character_card"]["scenarios"]) == 1
    assert len(data["initial_state"]["game_stats"]) == len(data["character_card"]["stats"])


def test_start_simulation_character_not_found(client, yi_scenario_id):
    response = client.post(
        "/api/v2/simulation/start",
        json={"character_name": "없는인물", "scenario_id": yi_scenario_id},
    )
    assert response.status_code == 404


def test_start_simulation_scenario_not_found(client):
    response = client.post(
        "/api/v2/simulation/start",
        json={"character_name": "이순신", "scenario_id": 9999},
    )
    assert response.status_code == 404


def test_play_turn(client, yi_scenario_id):
    response = client.post(
        "/api/v2/simulation/turn",
        json={"character_name": "이순신", "scenario_id": yi_scenario_id, "current_step": 1},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["current_step"] == 1
    assert data["total_steps"] >= 1
    assert data["choice_a"]["title"]
    assert data["choice_b"]["title"]
    assert data["toggle_question"]
    assert isinstance(data["choice_a"]["stat_effects"], dict)


def test_play_turn_character_not_found(client, yi_scenario_id):
    response = client.post(
        "/api/v2/simulation/turn",
        json={"character_name": "없는인물", "scenario_id": yi_scenario_id, "current_step": 1},
    )
    assert response.status_code == 404


def test_play_turn_scenario_not_found(client):
    response = client.post(
        "/api/v2/simulation/turn",
        json={"character_name": "이순신", "scenario_id": 9999, "current_step": 1},
    )
    assert response.status_code == 404


def test_play_turn_invalid_step(client, yi_scenario_id):
    response = client.post(
        "/api/v2/simulation/turn",
        json={"character_name": "이순신", "scenario_id": yi_scenario_id, "current_step": 99},
    )
    assert response.status_code == 400


def test_generate_ending_and_get_result(client, db_session, yi_scenario_id):
    ending_response = client.post(
        "/api/v2/simulation/ending",
        json={
            "character_name": "이순신",
            "scenario_id": yi_scenario_id,
            "choices_path": ["A", "A", "A"],
        },
    )
    assert ending_response.status_code == 200
    ending_data = ending_response.json()
    assert ending_data["result_code"] == "A-A-A"
    assert ending_data["title"]
    assert ending_data["summary_items"]
    assert ending_data["uuid"]
    assert "history_accuracy" in ending_data
    assert isinstance(ending_data["history_accuracy"], int)
    assert "history_score" in ending_data
    assert ending_data["history_score"] == ending_data["history_accuracy"]
    assert "character_image" in ending_data
    assert "selected_choices" in ending_data
    assert len(ending_data["selected_choices"]) == 3
    for choice in ending_data["selected_choices"]:
        assert "turn_no" in choice
        assert "turn_title" in choice
        assert "choice_key" in choice
        assert "title" in choice
        assert "is_historical" in choice
        assert "image_url" in choice

    session = db_session.scalar(select(PlaySession).where(PlaySession.id == ending_data["uuid"]))
    assert session is not None
    assert session.character_name == "이순신"
    assert session.choices_path == ["A", "A", "A"]
    assert session.choices_history == ending_data["choices_history"]
    assert session.ending_id is not None

    scenario = db_session.get(Scenario, session.scenario_id)
    assert scenario is not None
    assert scenario.sort_order is not None

    result_response = client.get(f"/api/v2/simulation/result/{ending_data['uuid']}")
    assert result_response.status_code == 200
    result_data = result_response.json()
    assert result_data["uuid"] == ending_data["uuid"]
    assert result_data["title"] == ending_data["title"]
    assert result_data["ending_markdown"]
    assert result_data["character_image"] == ending_data["character_image"]
    assert result_data["history_accuracy"] == ending_data["history_accuracy"]
    assert result_data["history_score"] == ending_data["history_score"]
    assert len(result_data["selected_choices"]) == 3


def test_generate_ending_links_logged_in_user_and_lists_sessions(client, db_session, yi_scenario_id, jwt_env):
    seed_local_user(db_session)
    login_response = client.post(
        "/api/v2/auth/session",
        json={"login_id": "userone", "password": "user-secret"},
    )
    assert login_response.status_code == 200

    ending_response = client.post(
        "/api/v2/simulation/ending",
        json={
            "character_name": "이순신",
            "scenario_id": yi_scenario_id,
            "choices_path": ["A", "A", "A"],
        },
    )
    assert ending_response.status_code == 200
    ending_data = ending_response.json()

    session = db_session.scalar(select(PlaySession).where(PlaySession.id == ending_data["uuid"]))
    assert session is not None
    assert session.user_id is not None

    sessions_response = client.get("/api/v2/auth/sessions")
    assert sessions_response.status_code == 200
    sessions = sessions_response.json()
    assert sessions["total"] == 1
    assert len(sessions["items"]) == 1
    assert sessions["items"][0]["id"] == ending_data["uuid"]
    assert sessions["items"][0]["scenario_id"] == yi_scenario_id
    assert sessions["items"][0]["choices_history"] == ending_data["choices_history"]


def test_generate_ending_not_found(client, yi_scenario_id):
    response = client.post(
        "/api/v2/simulation/ending",
        json={
            "character_name": "이순신",
            "scenario_id": yi_scenario_id,
            "choices_path": ["Z", "Z", "Z"],
        },
    )
    assert response.status_code == 404


def test_get_result_not_found(client):
    response = client.get("/api/v2/simulation/result/not-a-real-uuid")
    assert response.status_code == 404


def test_full_play_flow(client, yi_scenario_id):
    start = client.post(
        "/api/v2/simulation/start",
        json={"character_name": "이순신", "scenario_id": yi_scenario_id},
    )
    total_steps = len(start.json()["character_card"]["scenarios"][0]["turns"])

    for step in range(1, total_steps + 1):
        turn = client.post(
            "/api/v2/simulation/turn",
            json={
                "character_name": "이순신",
                "scenario_id": yi_scenario_id,
                "current_step": step,
            },
        )
        assert turn.status_code == 200
        assert turn.json()["total_steps"] == total_steps

    ending = client.post(
        "/api/v2/simulation/ending",
        json={
            "character_name": "이순신",
            "scenario_id": yi_scenario_id,
            "choices_path": ["A"] * total_steps,
        },
    )
    assert ending.status_code == 200
