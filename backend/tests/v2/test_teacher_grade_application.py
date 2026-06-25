from db.models import AuthProvider, TeacherGradeApplication, TeacherGradeApplicationStatus, User, UserGrade
from tests.admin_auth_helpers import SUPERADMIN_PASSWORD, SUPERADMIN_USERNAME
from core.security import hash_password


TEST_PASSWORD = "user-secret-123"


def seed_student_user(
    db_session,
    *,
    login_id: str = "student01",
    name: str | None = "학생",
    email: str | None = "student@example.com",
) -> User:
    user = User(
        auth_provider=AuthProvider.LOCAL,
        login_id=login_id,
        name=name,
        email=email,
        password_hash=hash_password(TEST_PASSWORD),
        nickname="학생닉",
        grade=UserGrade.STUDENT,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def login_user(client, login_id: str = "student01") -> str:
    response = client.post(
        "/api/v2/auth/login",
        json={"login_id": login_id, "password": TEST_PASSWORD},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def test_teacher_grade_application_requires_name_and_email(client, db_session, jwt_env):
    user = seed_student_user(db_session, login_id="student02", name=None, email=None)
    token = login_user(client, "student02")

    response = client.post(
        "/api/v2/auth/teacher-grade-applications",
        headers={"Authorization": f"Bearer {token}"},
        json={"school_name": "OO초등학교"},
    )

    assert response.status_code == 400
    assert "이름" in response.json()["detail"]


def test_teacher_grade_application_requires_school_name(client, db_session, jwt_env):
    seed_student_user(db_session, login_id="student02b", name="김선생", email="teacher@example.com")
    token = login_user(client, "student02b")

    response = client.post(
        "/api/v2/auth/teacher-grade-applications",
        headers={"Authorization": f"Bearer {token}"},
        json={"school_name": "   "},
    )

    assert response.status_code == 400
    assert "소속" in response.json()["detail"]


def test_teacher_grade_application_creates_pending_request(client, db_session, jwt_env):
    seed_student_user(db_session, login_id="student03", name="김선생", email="teacher@example.com")
    token = login_user(client, "student03")

    response = client.post(
        "/api/v2/auth/teacher-grade-applications",
        headers={"Authorization": f"Bearer {token}"},
        json={"school_name": "OO초등학교"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "pending"
    assert data["user_name"] == "김선생"
    assert data["user_email"] == "teacher@example.com"
    assert data["school_name"] == "OO초등학교"

    me_response = client.get(
        "/api/v2/auth/teacher-grade-applications/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_response.status_code == 200
    assert me_response.json()["status"] == "pending"


def test_admin_approve_requires_teacher_profile(client, db_session, jwt_env, superadmin_user):
    user = seed_student_user(db_session, login_id="student04", name=None, email=None)
    application = TeacherGradeApplication(
        user_id=user.id,
        status=TeacherGradeApplicationStatus.PENDING,
    )
    db_session.add(application)
    db_session.commit()
    db_session.refresh(application)

    admin_login = client.post(
        "/api/v2/admin/auth/login",
        json={"username": SUPERADMIN_USERNAME, "password": SUPERADMIN_PASSWORD},
    )
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["access_token"]

    response = client.post(
        f"/api/v2/admin/teacher-grade-applications/{application.id}/approve",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={},
    )

    assert response.status_code == 400
    assert "이름" in response.json()["detail"]


def test_admin_approve_promotes_user_to_teacher(client, db_session, jwt_env, superadmin_user):
    user = seed_student_user(db_session, login_id="student05", name="박선생", email="park@example.com")
    token = login_user(client, "student05")

    create_response = client.post(
        "/api/v2/auth/teacher-grade-applications",
        headers={"Authorization": f"Bearer {token}"},
        json={"school_name": "OO초등학교"},
    )
    application_id = create_response.json()["id"]

    admin_login = client.post(
        "/api/v2/admin/auth/login",
        json={"username": SUPERADMIN_USERNAME, "password": SUPERADMIN_PASSWORD},
    )
    admin_token = admin_login.json()["access_token"]

    approve_response = client.post(
        f"/api/v2/admin/teacher-grade-applications/{application_id}/approve",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"review_note": "승인"},
    )

    assert approve_response.status_code == 200
    assert approve_response.json()["status"] == "approved"

    db_session.refresh(user)
    assert user.grade == UserGrade.TEACHER
