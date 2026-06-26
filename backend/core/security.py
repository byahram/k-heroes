import base64
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

import jwt
import bcrypt
from google.auth.transport.requests import Request
from google.oauth2 import id_token as google_id_token

JWT_ALGORITHM = "HS256"
DEFAULT_JWT_EXPIRE_HOURS = 8
DEFAULT_REMEMBER_ME_EXPIRE_DAYS = 30
ADMIN_SESSION_COOKIE = "k_heroes_admin_session"
USER_SESSION_COOKIE = "k_heroes_user_session"


def get_jwt_secret() -> str:
    return os.environ.get("JWT_SECRET", "")


def get_jwt_expire_hours() -> int:
    return int(os.environ.get("JWT_EXPIRE_HOURS", str(DEFAULT_JWT_EXPIRE_HOURS)))


def get_remember_me_expire_hours() -> int:
    expire_days = int(os.environ.get("REMEMBER_ME_EXPIRE_DAYS", str(DEFAULT_REMEMBER_ME_EXPIRE_DAYS)))
    return expire_days * 24


def get_google_client_id() -> str:
    return os.environ.get("GOOGLE_CLIENT_ID", "").strip()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(
    *,
    subject_id: int,
    role: str,
    token_kind: str = "admin",
    expire_hours: int | None = None,
) -> str:
    secret = get_jwt_secret()
    if not secret:
        raise RuntimeError("JWT_SECRET is not configured")

    expire = datetime.now(timezone.utc) + timedelta(hours=expire_hours or get_jwt_expire_hours())
    payload: Dict[str, Any] = {
        "sub": str(subject_id),
        "role": role,
        "kind": token_kind,
        "exp": expire,
    }
    return jwt.encode(payload, secret, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Dict[str, Any]:
    secret = get_jwt_secret()
    if not secret:
        raise RuntimeError("JWT_SECRET is not configured")
    return jwt.decode(token, secret, algorithms=[JWT_ALGORITHM])


def _log_google_token_audience_hint(token: str, expected_client_id: str) -> None:
    try:
        parts = token.split(".")
        if len(parts) < 2:
            return
        payload_segment = parts[1]
        padding = "=" * (-len(payload_segment) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_segment + padding))
        print(
            "[google-auth] audience check:",
            f"expected={expected_client_id}",
            f"token_aud={payload.get('aud')}",
            f"token_azp={payload.get('azp')}",
            flush=True,
        )
    except Exception:
        return


def verify_google_id_token(token: str) -> Dict[str, Any]:
    client_id = get_google_client_id()
    if not client_id:
        raise RuntimeError("GOOGLE_CLIENT_ID is not configured")

    token = token.strip()
    request = Request()
    try:
        return google_id_token.verify_oauth2_token(
            token,
            request,
            client_id,
            clock_skew_in_seconds=10,
        )
    except Exception as exc:
        _log_google_token_audience_hint(token, client_id)
        print(f"[google-auth] token verify failed: {exc}", flush=True)
        raise ValueError(str(exc)) from exc


def get_cookie_samesite() -> str:
    return os.environ.get("COOKIE_SAMESITE", "lax").lower()
