import os

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from core.security import (
    ADMIN_SESSION_COOKIE,
    create_access_token,
    get_jwt_expire_hours,
    verify_password,
    get_cookie_samesite,
)
from db.database import get_db
from db.models import AdminUser
from models.auth.admin_user import (
    AdminLoginRequest,
    AdminLoginResponse,
    AdminSessionResponse,
    AdminUserResponse,
)
from repositories.auth import admin_user as admin_user_repository
from router.v2.deps import get_current_admin_user

router = APIRouter(prefix="/api/v2/admin/auth", tags=["Admin Auth v2"])


def authenticate_admin(body: AdminLoginRequest, db: Session) -> AdminUser:
    admin_user = admin_user_repository.get_admin_user_by_username(db, body.username)
    if not admin_user or not admin_user.is_active:
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다.")
    if not verify_password(body.password, admin_user.password_hash):
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다.")
    return admin_user


def issue_token(admin_user: AdminUser) -> str:
    try:
        return create_access_token(
            subject_id=admin_user.id,
            role=admin_user.role.value,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="관리자 인증이 설정되지 않았습니다.") from exc


def record_login(db: Session, admin_user: AdminUser) -> None:
    admin_user_repository.record_login(db, admin_user)
    db.commit()
    db.refresh(admin_user)


@router.post("/login", response_model=AdminLoginResponse)
def login(body: AdminLoginRequest, db: Session = Depends(get_db)):
    """어드민 — 로그인."""
    admin_user = authenticate_admin(body, db)
    access_token = issue_token(admin_user)
    record_login(db, admin_user)

    return AdminLoginResponse(
        access_token=access_token,
        admin_user=AdminUserResponse.model_validate(admin_user),
    )


@router.post("/session", response_model=AdminSessionResponse)
def create_session(
    body: AdminLoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    """어드민 — 브라우저 세션 로그인."""
    admin_user = authenticate_admin(body, db)
    if admin_user.role.value not in {"superadmin", "admin"}:
        raise HTTPException(status_code=403, detail="관리자 페이지 접근 권한이 없습니다.")

    access_token = issue_token(admin_user)
    record_login(db, admin_user)
    response.set_cookie(
        key=ADMIN_SESSION_COOKIE,
        value=access_token,
        httponly=True,
        max_age=get_jwt_expire_hours() * 60 * 60,
        path="/",
        samesite=get_cookie_samesite(),
        secure=os.environ.get("ADMIN_COOKIE_SECURE", "false").lower() == "true",
    )
    return AdminSessionResponse(admin_user=AdminUserResponse.model_validate(admin_user))


@router.post("/session/logout", status_code=204)
def delete_session(response: Response):
    """어드민 — 브라우저 세션 로그아웃."""
    response.delete_cookie(
        key=ADMIN_SESSION_COOKIE,
        path="/",
        httponly=True,
        samesite=get_cookie_samesite(),
        secure=os.environ.get("ADMIN_COOKIE_SECURE", "false").lower() == "true",
    )


@router.get("/me", response_model=AdminUserResponse)
def get_me(current_admin: AdminUser = Depends(get_current_admin_user)):
    """어드민 — 현재 로그인 정보."""
    return current_admin
