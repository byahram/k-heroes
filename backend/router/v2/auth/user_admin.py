from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import AdminRole, AuthProvider, UserGrade
from models.auth.user import (
    AdminMemberDetailResponse,
    AdminMemberResponse,
    AdminMemberUpdate,
    UserPlaySessionListResponse,
)
from models.common.pagination import ALLOWED_PAGE_SIZES, PaginatedResponse
from repositories.auth import user as user_repository
from router.v2.deps import require_roles

admin_router = APIRouter(
    prefix="/api/v2/admin/users",
    tags=["Users v2 Admin"],
    dependencies=[Depends(require_roles(AdminRole.SUPERADMIN, AdminRole.ADMIN))],
)


def _map_user_error(exc: Exception) -> HTTPException:
    if isinstance(exc, user_repository.UserNotFoundError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, user_repository.UserDuplicateError):
        return HTTPException(status_code=409, detail=str(exc))
    if isinstance(exc, ValueError):
        return HTTPException(status_code=400, detail=str(exc))
    raise exc


@admin_router.get("", response_model=PaginatedResponse[AdminMemberResponse])
def list_users(
    grade: Optional[UserGrade] = Query(None, description="student | teacher"),
    auth_provider: Optional[AuthProvider] = Query(None, description="local | google"),
    login_id: Optional[str] = Query(None, description="아이디 부분 일치"),
    name: Optional[str] = Query(None, description="이름 부분 일치"),
    email: Optional[str] = Query(None, description="이메일 부분 일치"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    page_size: int = Query(20, ge=1, le=100, description="페이지당 항목 수"),
    db: Session = Depends(get_db),
):
    """어드민 — 회원 목록."""
    if page_size not in ALLOWED_PAGE_SIZES:
        raise HTTPException(
            status_code=422,
            detail="페이지당 항목 수는 10, 20, 50, 100 중 하나여야 합니다.",
        )

    users, total = user_repository.list_users_for_admin(
        db,
        grade=grade,
        auth_provider=auth_provider,
        login_id=login_id,
        name=name,
        email=email,
        page=page,
        page_size=page_size,
    )
    return PaginatedResponse[AdminMemberResponse](
        items=[AdminMemberResponse.model_validate(user) for user in users],
        page=page,
        page_size=page_size,
        total=total,
        total_pages=(total + page_size - 1) // page_size,
    )


@admin_router.get("/{user_id}", response_model=AdminMemberDetailResponse)
def get_user(user_id: int, db: Session = Depends(get_db)):
    """어드민 — 회원 상세 (클래스 소속/보유 목록 포함)."""
    try:
        user = user_repository.get_user_detail_for_admin(db, user_id)
    except user_repository.UserNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return AdminMemberDetailResponse.model_validate(user)


@admin_router.get("/{user_id}/play-sessions", response_model=UserPlaySessionListResponse)
def list_user_play_sessions(
    user_id: int,
    page: int = Query(1, ge=1, description="페이지 번호"),
    page_size: int = Query(5, ge=1, le=100, description="페이지당 항목 수"),
    db: Session = Depends(get_db),
):
    """어드민 — 회원별 완료한 시뮬레이션 기록."""
    try:
        user_repository.get_user_for_admin_by_id(db, user_id)
    except user_repository.UserNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    items, total, average_history_score = user_repository.list_play_sessions_for_user_admin(
        db,
        user_id,
        page=page,
        page_size=page_size,
    )
    return UserPlaySessionListResponse(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=(total + page_size - 1) // page_size if total > 0 else 0,
        summary={
            "completed_count": total,
            "average_history_score": average_history_score,
        },
    )


@admin_router.patch("/{user_id}", response_model=AdminMemberResponse)
def update_user(user_id: int, body: AdminMemberUpdate, db: Session = Depends(get_db)):
    """어드민 — 회원 수정."""
    try:
        user = user_repository.update_user_by_admin(db, user_id, body)
        db.commit()
    except (user_repository.UserNotFoundError, user_repository.UserDuplicateError, ValueError) as exc:
        db.rollback()
        raise _map_user_error(exc) from exc

    return AdminMemberResponse.model_validate(user)


@admin_router.delete("/{user_id}", response_model=AdminMemberResponse)
def delete_user(user_id: int, db: Session = Depends(get_db)):
    """어드민 — 회원 소프트 삭제."""
    try:
        user = user_repository.delete_user_by_admin(db, user_id)
        db.commit()
    except user_repository.UserNotFoundError as exc:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return AdminMemberResponse.model_validate(user)
