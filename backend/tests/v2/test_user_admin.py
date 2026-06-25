import pytest

from db.models import AuthProvider, User, UserGrade
from tests.admin_auth_helpers import SUPERADMIN_PASSWORD, SUPERADMIN_USERNAME, login_headers
from core.security import hash_password


TEST_PASSWORD = "user-secret-123"


def seed_user(
    db_session,
    *,
    login_id: str = "member01",
    name: str | None = "홍길동",
    email: str | None = "member@example.com",
    grade: UserGrade = UserGrade.STUDENT,
    auth_provider: AuthProvider = AuthProvider.LOCAL,
) -> User:
    user = User(
        auth_provider=auth_provider,
        provider_user_id="google-sub-1" if auth_provider == AuthProvider.GOOGLE else None,
        login_id=login_id,
        name=name,
        email=email,
        password_hash=hash_password(TEST_PASSWORD) if auth_provider == AuthProvider.LOCAL else None,
        nickname="닉네임",
        grade=grade,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.mark.usefixtures("jwt_env", "superadmin_user")
def test_list_users(client, db_session):
    seed_user(db_session, login_id="member_list_01")
    seed_user(db_session, login_id="member_list_02", grade=UserGrade.TEACHER)

    response = client.get(
        "/api/v2/admin/users",
        headers=login_headers(client, SUPERADMIN_USERNAME, SUPERADMIN_PASSWORD),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 2
    assert all("login_id" in item for item in data["items"])


@pytest.mark.usefixtures("jwt_env", "superadmin_user")
def test_list_users_filter_grade(client, db_session):
    seed_user(db_session, login_id="member_filter_student", grade=UserGrade.STUDENT)
    seed_user(db_session, login_id="member_filter_teacher", grade=UserGrade.TEACHER)

    response = client.get(
        "/api/v2/admin/users?grade=teacher&login_id=member_filter_teacher",
        headers=login_headers(client, SUPERADMIN_USERNAME, SUPERADMIN_PASSWORD),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["login_id"] == "member_filter_teacher"
    assert data["items"][0]["grade"] == "teacher"


@pytest.mark.usefixtures("jwt_env", "superadmin_user")
def test_list_users_filter_login_id_and_name(client, db_session):
    seed_user(db_session, login_id="search_target", name="김철수", email="kim@example.com")
    seed_user(db_session, login_id="other_user", name="이영희", email="lee@example.com")
    headers = login_headers(client, SUPERADMIN_USERNAME, SUPERADMIN_PASSWORD)

    by_login = client.get("/api/v2/admin/users?login_id=search_target", headers=headers)
    assert by_login.status_code == 200
    assert by_login.json()["total"] == 1
    assert by_login.json()["items"][0]["login_id"] == "search_target"

    by_name = client.get("/api/v2/admin/users?name=철수", headers=headers)
    assert by_name.status_code == 200
    assert by_name.json()["total"] == 1
    assert by_name.json()["items"][0]["name"] == "김철수"


@pytest.mark.usefixtures("jwt_env", "superadmin_user")
def test_get_user_detail(client, db_session):
    user = seed_user(db_session, login_id="member_detail")

    response = client.get(
        f"/api/v2/admin/users/{user.id}",
        headers=login_headers(client, SUPERADMIN_USERNAME, SUPERADMIN_PASSWORD),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == user.id
    assert data["login_id"] == "member_detail"


@pytest.mark.usefixtures("jwt_env", "superadmin_user")
def test_update_user(client, db_session):
    user = seed_user(db_session, login_id="member_update")

    response = client.patch(
        f"/api/v2/admin/users/{user.id}",
        headers=login_headers(client, SUPERADMIN_USERNAME, SUPERADMIN_PASSWORD),
        json={"name": "수정된 이름", "grade": "teacher"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "수정된 이름"
    assert data["grade"] == "teacher"


@pytest.mark.usefixtures("jwt_env", "superadmin_user")
def test_update_google_user_allows_name_change(client, db_session):
    user = seed_user(
        db_session,
        login_id="g@google-sub-2",
        name="구글유저",
        email="google@example.com",
        auth_provider=AuthProvider.GOOGLE,
    )

    response = client.patch(
        f"/api/v2/admin/users/{user.id}",
        headers=login_headers(client, SUPERADMIN_USERNAME, SUPERADMIN_PASSWORD),
        json={"name": "수정된 구글 이름"},
    )

    assert response.status_code == 200
    assert response.json()["name"] == "수정된 구글 이름"
    assert response.json()["email"] == "google@example.com"


@pytest.mark.usefixtures("jwt_env", "superadmin_user")
def test_update_google_user_ignores_null_email_payload(client, db_session):
    user = seed_user(
        db_session,
        login_id="g@google-sub-3",
        name="구글유저",
        email="google@example.com",
        auth_provider=AuthProvider.GOOGLE,
    )

    response = client.patch(
        f"/api/v2/admin/users/{user.id}",
        headers=login_headers(client, SUPERADMIN_USERNAME, SUPERADMIN_PASSWORD),
        json={"name": "이름만 수정", "email": None},
    )

    assert response.status_code == 200
    assert response.json()["name"] == "이름만 수정"
    assert response.json()["email"] == "google@example.com"


@pytest.mark.usefixtures("jwt_env", "superadmin_user")
def test_update_google_user_rejects_email_change(client, db_session):
    user = seed_user(
        db_session,
        login_id="g@google-sub-1",
        auth_provider=AuthProvider.GOOGLE,
    )

    response = client.patch(
        f"/api/v2/admin/users/{user.id}",
        headers=login_headers(client, SUPERADMIN_USERNAME, SUPERADMIN_PASSWORD),
        json={"email": "new@example.com"},
    )

    assert response.status_code == 400
    assert "email" in response.json()["detail"]


@pytest.mark.usefixtures("jwt_env", "superadmin_user")
def test_delete_user_soft_deletes(client, db_session):
    user = seed_user(db_session, login_id="member_delete")

    response = client.delete(
        f"/api/v2/admin/users/{user.id}",
        headers=login_headers(client, SUPERADMIN_USERNAME, SUPERADMIN_PASSWORD),
    )

    assert response.status_code == 200
    assert response.json()["deleted_at"] is not None

    db_session.refresh(user)
    assert user.deleted_at is not None

    list_response = client.get(
        "/api/v2/admin/users?login_id=member_delete",
        headers=login_headers(client, SUPERADMIN_USERNAME, SUPERADMIN_PASSWORD),
    )
    assert list_response.json()["total"] == 0


@pytest.mark.usefixtures("jwt_env", "superadmin_user")
def test_deleted_user_cannot_login(client, db_session):
    user = seed_user(db_session, login_id="member_login_block")

    client.delete(
        f"/api/v2/admin/users/{user.id}",
        headers=login_headers(client, SUPERADMIN_USERNAME, SUPERADMIN_PASSWORD),
    )

    login_response = client.post(
        "/api/v2/auth/login",
        json={"login_id": "member_login_block", "password": TEST_PASSWORD},
    )
    assert login_response.status_code == 401
