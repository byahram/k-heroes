from core.auth_policy import LOGIN_ID_MAX_LENGTH, build_google_login_id


def test_build_google_login_id_uses_sub():
    assert build_google_login_id("1092837465") == "g@1092837465"


def test_build_google_login_id_hashes_when_sub_is_too_long():
    long_sub = "1" * 60
    login_id = build_google_login_id(long_sub)

    assert login_id.startswith("g@")
    assert len(login_id) == LOGIN_ID_MAX_LENGTH
