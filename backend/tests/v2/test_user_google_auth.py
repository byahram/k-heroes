from db.models import AuthProvider, User, UserGrade


def fake_google_payload(sub: str, email: str = "google-user@example.com", name: str = "구글유저"):
    return {
        "sub": sub,
        "email": email,
        "name": name,
    }


def test_google_login_creates_user(client, db_session, monkeypatch, jwt_env):
    from router.v2 import auth as auth_router

    monkeypatch.setattr(
        auth_router,
        "verify_google_id_token",
        lambda token: fake_google_payload("google-sub-1"),
    )

    response = client.post("/api/v2/auth/google", json={"id_token": "google-id-token"})

    assert response.status_code == 200
    data = response.json()
    assert data["access_token"]
    assert data["user"]["auth_provider"] == "google"
    assert data["user"]["provider_user_id"] == "google-sub-1"
    assert data["user"]["login_id"] == "g@google-sub-1"
    assert data["user"]["email"] == "google-user@example.com"
    assert data["user"]["name"] == "구글유저"
    assert data["user"]["grade"] == "student"

    user = db_session.query(User).filter(User.provider_user_id == "google-sub-1").one()
    assert user.auth_provider == AuthProvider.GOOGLE
    assert user.login_id == "g@google-sub-1"
    assert user.grade == UserGrade.STUDENT


def test_google_login_reuses_existing_user(client, db_session, monkeypatch, jwt_env):
    from router.v2 import auth as auth_router

    existing = User(
        auth_provider=AuthProvider.GOOGLE,
        provider_user_id="google-sub-2",
        login_id=None,
        name=None,
        email=None,
        password_hash=None,
        nickname=None,
        grade=UserGrade.STUDENT,
    )
    db_session.add(existing)
    db_session.commit()

    monkeypatch.setattr(
        auth_router,
        "verify_google_id_token",
        lambda token: fake_google_payload("google-sub-2", email="updated@example.com", name="업데이트된이름"),
    )

    response = client.post("/api/v2/auth/google", json={"id_token": "google-id-token"})

    assert response.status_code == 200
    data = response.json()
    assert data["user"]["id"] == existing.id
    assert data["user"]["provider_user_id"] == "google-sub-2"
    assert data["user"]["name"] == "업데이트된이름"
    assert data["user"]["email"] == "updated@example.com"

    user = db_session.get(User, existing.id)
    assert user is not None
    assert user.provider_user_id == "google-sub-2"
    assert user.email == "updated@example.com"


def test_google_session_login_sets_cookie(client, monkeypatch, jwt_env):
    from router.v2 import auth as auth_router

    monkeypatch.setattr(
        auth_router,
        "verify_google_id_token",
        lambda token: fake_google_payload("google-sub-3"),
    )

    response = client.post("/api/v2/auth/google/session", json={"id_token": "google-id-token"})

    assert response.status_code == 200
    assert response.json()["user"]["provider_user_id"] == "google-sub-3"
    assert response.cookies.get("k_heroes_user_session")

    me_response = client.get("/api/v2/auth/me")
    assert me_response.status_code == 200
    assert me_response.json()["provider_user_id"] == "google-sub-3"


def test_google_profile_update_without_password(client, db_session, monkeypatch, jwt_env):
    from router.v2 import auth as auth_router

    monkeypatch.setattr(
        auth_router,
        "verify_google_id_token",
        lambda token: fake_google_payload("google-sub-4"),
    )

    login_response = client.post("/api/v2/auth/google", json={"id_token": "google-id-token"})
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]

    update_response = client.patch(
        "/api/v2/auth/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "새이름", "nickname": "새닉네임"},
    )
    assert update_response.status_code == 200
    data = update_response.json()
    assert data["name"] == "새이름"
    assert data["nickname"] == "새닉네임"


def test_google_profile_update_rejects_password_change(client, monkeypatch, jwt_env):
    from router.v2 import auth as auth_router

    monkeypatch.setattr(
        auth_router,
        "verify_google_id_token",
        lambda token: fake_google_payload("google-sub-5"),
    )

    login_response = client.post("/api/v2/auth/google", json={"id_token": "google-id-token"})
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]

    update_response = client.patch(
        "/api/v2/auth/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "anything", "new_password": "new-password-123"},
    )
    assert update_response.status_code == 400


def test_google_profile_update_rejects_email_change(client, monkeypatch, jwt_env):
    from router.v2 import auth as auth_router

    monkeypatch.setattr(
        auth_router,
        "verify_google_id_token",
        lambda token: fake_google_payload("google-sub-6"),
    )

    login_response = client.post("/api/v2/auth/google", json={"id_token": "google-id-token"})
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]

    update_response = client.patch(
        "/api/v2/auth/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"email": "changed@example.com"},
    )
    assert update_response.status_code == 400
    assert update_response.json()["detail"] == "Google 계정 이메일은 변경할 수 없습니다."


def test_google_login_backfills_missing_login_id(client, db_session, monkeypatch, jwt_env):
    from router.v2 import auth as auth_router

    existing = User(
        auth_provider=AuthProvider.GOOGLE,
        provider_user_id="google-sub-backfill",
        login_id=None,
        name="기존유저",
        email="backfill@example.com",
        password_hash=None,
        nickname="기존유저",
        grade=UserGrade.STUDENT,
    )
    db_session.add(existing)
    db_session.commit()

    monkeypatch.setattr(
        auth_router,
        "verify_google_id_token",
        lambda token: fake_google_payload("google-sub-backfill", email="backfill@example.com", name="기존유저"),
    )

    response = client.post("/api/v2/auth/google/session", json={"id_token": "google-id-token"})

    assert response.status_code == 200
    assert response.json()["user"]["login_id"] == "g@google-sub-backfill"
