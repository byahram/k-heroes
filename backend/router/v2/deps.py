from typing import Optional, Union

import jwt
from fastapi import Cookie, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from core.security import ADMIN_SESSION_COOKIE, USER_SESSION_COOKIE, decode_access_token, get_jwt_secret
from db.database import get_db
from db.models import AdminRole, AdminUser
from db.models import User, UserGrade

security = HTTPBearer(auto_error=False)
user_security = HTTPBearer(auto_error=False)

CONTENT_ADMIN_ROLES = (AdminRole.SUPERADMIN, AdminRole.ADMIN)


def get_current_admin_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    session_token: Optional[str] = Cookie(default=None, alias=ADMIN_SESSION_COOKIE),
    db: Session = Depends(get_db),
) -> AdminUser:
    if not get_jwt_secret():
        raise HTTPException(status_code=503, detail="관리자 인증이 설정되지 않았습니다.")
    token = credentials.credentials if credentials else session_token
    if not token:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")

    try:
        payload = decode_access_token(token)
        if payload.get("kind") not in {None, "admin"}:
            raise ValueError("invalid token kind")
        admin_user_id = int(payload["sub"])
    except (jwt.InvalidTokenError, ValueError, KeyError, TypeError):
        raise HTTPException(status_code=401, detail="로그인이 만료되었습니다.") from None

    admin_user = db.get(AdminUser, admin_user_id)
    if not admin_user or admin_user.deleted_at is not None or not admin_user.is_active:
        raise HTTPException(status_code=401, detail="사용할 수 없는 관리자 계정입니다.")
    return admin_user


def require_roles(*roles: Union[AdminRole, str]):
    allowed = {role.value if isinstance(role, AdminRole) else role for role in roles}

    def dependency(current_admin: AdminUser = Depends(get_current_admin_user)) -> AdminUser:
        if current_admin.role.value not in allowed:
            raise HTTPException(status_code=403, detail="해당 작업을 수행할 권한이 없습니다.")
        return current_admin

    return dependency


require_content_admin = require_roles(*CONTENT_ADMIN_ROLES)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(user_security),
    session_token: Optional[str] = Cookie(default=None, alias=USER_SESSION_COOKIE),
    db: Session = Depends(get_db),
) -> User:
    if not get_jwt_secret():
        raise HTTPException(status_code=503, detail="회원 인증이 설정되지 않았습니다.")
    token = credentials.credentials if credentials else session_token
    if not token:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")

    try:
        payload = decode_access_token(token)
        if payload.get("kind") != "user":
            raise ValueError("invalid token kind")
        user_id = int(payload["sub"])
    except (jwt.InvalidTokenError, ValueError, KeyError, TypeError):
        raise HTTPException(status_code=401, detail="로그인이 만료되었습니다.") from None

    user = db.get(User, user_id)
    if not user or user.deleted_at is not None:
        raise HTTPException(status_code=401, detail="사용할 수 없는 회원 계정입니다.")
    return user


def require_teacher(current_user: User = Depends(get_current_user)) -> User:
    if current_user.grade != UserGrade.TEACHER:
        raise HTTPException(status_code=403, detail="지도자만 이용할 수 있습니다.")
    return current_user


def require_student(current_user: User = Depends(get_current_user)) -> User:
    if current_user.grade != UserGrade.STUDENT:
        raise HTTPException(status_code=403, detail="학생만 이용할 수 있습니다.")
    return current_user


def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(user_security),
    session_token: Optional[str] = Cookie(default=None, alias=USER_SESSION_COOKIE),
    db: Session = Depends(get_db),
) -> Optional[User]:
    if not get_jwt_secret():
        return None
    token = credentials.credentials if credentials else session_token
    if not token:
        return None

    try:
        payload = decode_access_token(token)
        if payload.get("kind") != "user":
            return None
        user_id = int(payload["sub"])
    except (jwt.InvalidTokenError, ValueError, KeyError, TypeError):
        return None

    user = db.get(User, user_id)
    if not user or user.deleted_at is not None:
        return None
    return user
