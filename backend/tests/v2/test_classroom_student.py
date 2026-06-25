import pytest

from core.class_policy import current_year_prefix
from tests.v2.test_classroom import seed_teacher_user
from tests.v2.test_teacher_grade_application import login_user, seed_student_user


def _create_class(client, teacher_token: str, *, name: str, entry_code_suffix: str) -> dict:
    response = client.post(
        "/api/v2/classes",
        headers={"Authorization": f"Bearer {teacher_token}"},
        json={"name": name, "entry_code_suffix": entry_code_suffix},
    )
    assert response.status_code == 201
    return response.json()


@pytest.mark.usefixtures("jwt_env")
def test_student_can_join_class_with_entry_code(client, db_session):
    seed_teacher_user(db_session, login_id="teacher_join_01")
    teacher_token = login_user(client, "teacher_join_01")
    class_data = _create_class(
        client,
        teacher_token,
        name="4학년 1반",
        entry_code_suffix="JOIN1",
    )

    seed_student_user(db_session, login_id="student_join_01")
    student_token = login_user(client, "student_join_01")

    response = client.post(
        "/api/v2/my/classes/join",
        headers={"Authorization": f"Bearer {student_token}"},
        json={"entry_code": class_data["entry_code"]},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["class_id"] == class_data["id"]
    assert data["class_name"] == "4학년 1반"
    assert data["entry_code"] == class_data["entry_code"]
    assert data["is_class_active"] is True


@pytest.mark.usefixtures("jwt_env")
def test_student_lists_joined_classes(client, db_session):
    seed_teacher_user(db_session, login_id="teacher_join_02")
    teacher_token = login_user(client, "teacher_join_02")
    class_data = _create_class(
        client,
        teacher_token,
        name="코딩반",
        entry_code_suffix="JOIN2",
    )

    seed_student_user(db_session, login_id="student_join_02")
    student_token = login_user(client, "student_join_02")

    join_response = client.post(
        "/api/v2/my/classes/join",
        headers={"Authorization": f"Bearer {student_token}"},
        json={"entry_code": class_data["entry_code"]},
    )
    assert join_response.status_code == 201

    list_response = client.get(
        "/api/v2/my/classes",
        headers={"Authorization": f"Bearer {student_token}"},
    )

    assert list_response.status_code == 200
    data = list_response.json()
    assert data["total"] == 1
    assert len(data["items"]) == 1
    assert data["items"][0]["class_name"] == "코딩반"
    assert data["items"][0]["entry_code"] == class_data["entry_code"]


@pytest.mark.usefixtures("jwt_env")
def test_student_cannot_join_with_invalid_entry_code(client, db_session):
    seed_student_user(db_session, login_id="student_join_03")
    student_token = login_user(client, "student_join_03")

    response = client.post(
        "/api/v2/my/classes/join",
        headers={"Authorization": f"Bearer {student_token}"},
        json={"entry_code": "INVALID"},
    )

    assert response.status_code == 400


@pytest.mark.usefixtures("jwt_env")
def test_student_cannot_join_unknown_entry_code(client, db_session):
    seed_student_user(db_session, login_id="student_join_04")
    student_token = login_user(client, "student_join_04")

    response = client.post(
        "/api/v2/my/classes/join",
        headers={"Authorization": f"Bearer {student_token}"},
        json={"entry_code": f"{current_year_prefix()}UNKNOWN"},
    )

    assert response.status_code == 404


@pytest.mark.usefixtures("jwt_env")
def test_student_cannot_join_inactive_class(client, db_session):
    seed_teacher_user(db_session, login_id="teacher_join_03")
    teacher_token = login_user(client, "teacher_join_03")
    class_data = _create_class(
        client,
        teacher_token,
        name="비활성 반",
        entry_code_suffix="JOIN3",
    )

    deactivate_response = client.patch(
        f"/api/v2/classes/{class_data['id']}",
        headers={"Authorization": f"Bearer {teacher_token}"},
        json={"is_active": False},
    )
    assert deactivate_response.status_code == 200

    seed_student_user(db_session, login_id="student_join_05")
    student_token = login_user(client, "student_join_05")

    response = client.post(
        "/api/v2/my/classes/join",
        headers={"Authorization": f"Bearer {student_token}"},
        json={"entry_code": class_data["entry_code"]},
    )

    assert response.status_code == 400
    assert "비활성화" in response.json()["detail"]


@pytest.mark.usefixtures("jwt_env")
def test_student_cannot_join_same_class_twice(client, db_session):
    seed_teacher_user(db_session, login_id="teacher_join_04")
    teacher_token = login_user(client, "teacher_join_04")
    class_data = _create_class(
        client,
        teacher_token,
        name="중복 가입 반",
        entry_code_suffix="JOIN4",
    )

    seed_student_user(db_session, login_id="student_join_06")
    student_token = login_user(client, "student_join_06")

    first_response = client.post(
        "/api/v2/my/classes/join",
        headers={"Authorization": f"Bearer {student_token}"},
        json={"entry_code": class_data["entry_code"]},
    )
    assert first_response.status_code == 201

    second_response = client.post(
        "/api/v2/my/classes/join",
        headers={"Authorization": f"Bearer {student_token}"},
        json={"entry_code": class_data["entry_code"]},
    )

    assert second_response.status_code == 409


@pytest.mark.usefixtures("jwt_env")
def test_teacher_cannot_join_class(client, db_session):
    seed_teacher_user(db_session, login_id="teacher_join_05")
    teacher_token = login_user(client, "teacher_join_05")
    class_data = _create_class(
        client,
        teacher_token,
        name="선생님 가입 시도",
        entry_code_suffix="JOIN5",
    )

    response = client.post(
        "/api/v2/my/classes/join",
        headers={"Authorization": f"Bearer {teacher_token}"},
        json={"entry_code": class_data["entry_code"]},
    )

    assert response.status_code == 403


@pytest.mark.usefixtures("jwt_env")
def test_joined_class_increases_teacher_member_count(client, db_session):
    seed_teacher_user(db_session, login_id="teacher_join_06")
    teacher_token = login_user(client, "teacher_join_06")
    class_data = _create_class(
        client,
        teacher_token,
        name="인원 확인 반",
        entry_code_suffix="JOIN6",
    )

    seed_student_user(db_session, login_id="student_join_07")
    student_token = login_user(client, "student_join_07")

    join_response = client.post(
        "/api/v2/my/classes/join",
        headers={"Authorization": f"Bearer {student_token}"},
        json={"entry_code": class_data["entry_code"]},
    )
    assert join_response.status_code == 201

    detail_response = client.get(
        f"/api/v2/classes/{class_data['id']}",
        headers={"Authorization": f"Bearer {teacher_token}"},
    )

    assert detail_response.status_code == 200
    assert detail_response.json()["member_count"] == 1
