import pytest

from core.class_policy import current_year_prefix
from db.models import User, UserGrade
from tests.v2.test_teacher_grade_application import login_user, seed_student_user


def seed_teacher_user(db_session, *, login_id: str = "teacher01") -> User:
    user = seed_student_user(
        db_session,
        login_id=login_id,
        name="박선생",
        email=f"{login_id}@example.com",
    )
    user.grade = UserGrade.TEACHER
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.mark.usefixtures("jwt_env")
def test_teacher_can_create_class(client, db_session):
    seed_teacher_user(db_session, login_id="teacher_class_01")
    token = login_user(client, "teacher_class_01")

    response = client.post(
        "/api/v2/classes",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "2026년 4학년 1반", "entry_code_suffix": "4A1"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "2026년 4학년 1반"
    assert data["entry_code"].endswith("4A1")
    assert data["entry_code"].startswith(current_year_prefix())
    assert data["is_active"] is True
    assert data["member_count"] == 0


@pytest.mark.usefixtures("jwt_env")
def test_student_cannot_create_class(client, db_session):
    seed_student_user(db_session, login_id="student_class_01")
    token = login_user(client, "student_class_01")

    response = client.post(
        "/api/v2/classes",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "학생 클래스", "entry_code_suffix": "TEST"},
    )

    assert response.status_code == 403


@pytest.mark.usefixtures("jwt_env")
def test_teacher_lists_only_own_classes(client, db_session):
    seed_teacher_user(db_session, login_id="teacher_class_02")
    token = login_user(client, "teacher_class_02")
    seed_teacher_user(db_session, login_id="teacher_class_03")
    other_token = login_user(client, "teacher_class_03")

    create_response = client.post(
        "/api/v2/classes",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "내 클래스", "entry_code_suffix": "MINE"},
    )
    class_id = create_response.json()["id"]

    client.post(
        "/api/v2/classes",
        headers={"Authorization": f"Bearer {other_token}"},
        json={"name": "다른 선생님 클래스", "entry_code_suffix": "OTHER"},
    )

    list_response = client.get(
        "/api/v2/classes",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert list_response.status_code == 200
    data = list_response.json()
    items = data["items"]
    assert len(items) == 1
    assert items[0]["id"] == class_id

    detail_response = client.get(
        f"/api/v2/classes/{class_id}",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert detail_response.status_code == 404


@pytest.mark.usefixtures("jwt_env")
def test_teacher_cannot_create_duplicate_entry_code(client, db_session):
    seed_teacher_user(db_session, login_id="teacher_class_dup")
    token = login_user(client, "teacher_class_dup")

    first = client.post(
        "/api/v2/classes",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "1반", "entry_code_suffix": "DUP1"},
    )
    assert first.status_code == 201

    second = client.post(
        "/api/v2/classes",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "2반", "entry_code_suffix": "DUP1"},
    )
    assert second.status_code == 409


@pytest.mark.usefixtures("jwt_env")
def test_teacher_can_get_class_detail_with_members(client, db_session):
    from db.models import ClassMembership

    teacher = seed_teacher_user(db_session, login_id="teacher_class_detail")
    student = seed_student_user(db_session, login_id="student_in_class", name="김학생", nickname="학생1")
    token = login_user(client, "teacher_class_detail")

    create_response = client.post(
        "/api/v2/classes",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "4학년 1반", "entry_code_suffix": "DETAIL"},
    )
    class_id = create_response.json()["id"]

    db_session.add(
        ClassMembership(
            class_id=class_id,
            user_id=student.id,
            is_active=True,
        )
    )
    db_session.commit()

    detail_response = client.get(
        f"/api/v2/classes/{class_id}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert detail_response.status_code == 200
    data = detail_response.json()
    assert data["name"] == "4학년 1반"
    assert data["member_count"] == 1
    assert len(data["members"]) == 1
    assert data["members"][0]["login_id"] == "student_in_class"
    assert data["members"][0]["name"] == "김학생"
    assert data["members"][0]["nickname"] == "학생1"
    assert data["members"][0]["is_active"] is True


@pytest.mark.usefixtures("jwt_env")
def test_teacher_can_update_and_delete_class(client, db_session):
    seed_teacher_user(db_session, login_id="teacher_class_04")
    token = login_user(client, "teacher_class_04")

    create_response = client.post(
        "/api/v2/classes",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "방과후 코딩반", "entry_code_suffix": "CODE"},
    )
    class_id = create_response.json()["id"]

    patch_response = client.patch(
        f"/api/v2/classes/{class_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "2026 방과후 코딩반", "is_active": False},
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["name"] == "2026 방과후 코딩반"
    assert patch_response.json()["is_active"] is False

    delete_response = client.delete(
        f"/api/v2/classes/{class_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert delete_response.status_code == 200

    list_response = client.get(
        "/api/v2/classes",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert list_response.json()["items"] == []


@pytest.mark.usefixtures("jwt_env")
def test_teacher_list_classes_pagination(client, db_session):
    seed_teacher_user(db_session, login_id="teacher_class_page")
    token = login_user(client, "teacher_class_page")

    for index in range(3):
        client.post(
            "/api/v2/classes",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": f"클래스 {index}", "entry_code_suffix": f"PG{index}"},
        )

    page1 = client.get(
        "/api/v2/classes?page=1&page_size=2",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert page1.status_code == 200
    data = page1.json()
    assert data["total"] == 3
    assert data["total_pages"] == 2
    assert len(data["items"]) == 2

    page2 = client.get(
        "/api/v2/classes?page=2&page_size=2",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert len(page2.json()["items"]) == 1


@pytest.mark.usefixtures("jwt_env")
def test_teacher_list_classes_filter_by_name(client, db_session):
    seed_teacher_user(db_session, login_id="teacher_class_search")
    token = login_user(client, "teacher_class_search")

    client.post(
        "/api/v2/classes",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "4학년 1반", "entry_code_suffix": "SRCH1"},
    )
    client.post(
        "/api/v2/classes",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "방과후 코딩반", "entry_code_suffix": "SRCH2"},
    )

    response = client.get(
        "/api/v2/classes?name=코딩",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "방과후 코딩반"
