import pytest

from core.class_policy import current_year_prefix
from db.models import UserGrade
from tests.admin_auth_helpers import SUPERADMIN_PASSWORD, SUPERADMIN_USERNAME, login_headers
from tests.v2.test_classroom import login_user, seed_teacher_user


@pytest.mark.usefixtures("jwt_env", "superadmin_user")
def test_admin_list_classes(client, db_session):
    seed_teacher_user(db_session, login_id="admin_class_teacher")
    teacher_token = login_user(client, "admin_class_teacher")
    client.post(
        "/api/v2/classes",
        headers={"Authorization": f"Bearer {teacher_token}"},
        json={"name": "4학년 1반", "entry_code_suffix": "ADMIN"},
    )

    response = client.get(
        "/api/v2/admin/classes",
        headers=login_headers(client, SUPERADMIN_USERNAME, SUPERADMIN_PASSWORD),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    assert any(item["entry_code"] == f"{current_year_prefix()}ADMIN" for item in data["items"])


@pytest.mark.usefixtures("jwt_env", "superadmin_user")
def test_admin_list_classes_filter_entry_code(client, db_session):
    seed_teacher_user(db_session, login_id="admin_class_teacher2")
    teacher_token = login_user(client, "admin_class_teacher2")
    client.post(
        "/api/v2/classes",
        headers={"Authorization": f"Bearer {teacher_token}"},
        json={"name": "코딩반", "entry_code_suffix": "CODE99"},
    )

    response = client.get(
        f"/api/v2/admin/classes?entry_code={current_year_prefix()}CODE99",
        headers=login_headers(client, SUPERADMIN_USERNAME, SUPERADMIN_PASSWORD),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "코딩반"


@pytest.mark.usefixtures("jwt_env", "superadmin_user")
def test_admin_get_class_detail(client, db_session):
    seed_teacher_user(db_session, login_id="admin_class_teacher3", name="김선생")
    teacher_token = login_user(client, "admin_class_teacher3")
    created = client.post(
        "/api/v2/classes",
        headers={"Authorization": f"Bearer {teacher_token}"},
        json={"name": "방과후반", "entry_code_suffix": "AFTER"},
    )
    class_id = created.json()["id"]

    response = client.get(
        f"/api/v2/admin/classes/{class_id}",
        headers=login_headers(client, SUPERADMIN_USERNAME, SUPERADMIN_PASSWORD),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == class_id
    assert data["teacher_login_id"] == "admin_class_teacher3"
    assert data["teacher_name"] == "김선생"
    assert data["member_count"] == 0
    assert data["members"] == []


@pytest.mark.usefixtures("jwt_env", "superadmin_user")
def test_admin_get_class_detail_with_members(client, db_session):
    from db.models import ClassMembership
    from tests.v2.test_classroom import seed_student_user

    seed_teacher_user(db_session, login_id="admin_class_teacher4", name="이선생")
    student = seed_student_user(
        db_session,
        login_id="admin_class_student",
        name="박학생",
        nickname="학생A",
    )
    teacher_token = login_user(client, "admin_class_teacher4")
    created = client.post(
        "/api/v2/classes",
        headers={"Authorization": f"Bearer {teacher_token}"},
        json={"name": "5학년 2반", "entry_code_suffix": "MEMB"},
    )
    class_id = created.json()["id"]

    db_session.add(
        ClassMembership(
            class_id=class_id,
            user_id=student.id,
            is_active=True,
        )
    )
    db_session.commit()

    response = client.get(
        f"/api/v2/admin/classes/{class_id}",
        headers=login_headers(client, SUPERADMIN_USERNAME, SUPERADMIN_PASSWORD),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["member_count"] == 1
    assert len(data["members"]) == 1
    assert data["members"][0]["login_id"] == "admin_class_student"
    assert data["members"][0]["name"] == "박학생"
    assert data["members"][0]["nickname"] == "학생A"


@pytest.mark.usefixtures("jwt_env")
def test_admin_classes_requires_admin_auth(client):
    response = client.get("/api/v2/admin/classes")
    assert response.status_code == 401
