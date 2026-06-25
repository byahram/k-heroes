from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import AdminRole, AdminUser, TeacherGradeApplicationStatus, User
from models.auth.teacher_grade_application import (
    TeacherGradeApplicationCreateRequest,
    TeacherGradeApplicationResponse,
    TeacherGradeApplicationReviewRequest,
)
from models.common.pagination import ALLOWED_PAGE_SIZES, PaginatedResponse
from repositories.auth import teacher_grade_application as teacher_grade_application_repository
from core.teacher_policy import TeacherProfileIncompleteError
from router.v2.deps import get_current_user, require_roles

router = APIRouter(prefix="/api/v2/auth/teacher-grade-applications", tags=["Teacher Grade Applications v2"])

admin_router = APIRouter(
    prefix="/api/v2/admin/teacher-grade-applications",
    tags=["Teacher Grade Applications v2 Admin"],
    dependencies=[Depends(require_roles(AdminRole.SUPERADMIN, AdminRole.ADMIN))],
)


def _map_application_error(exc: Exception) -> HTTPException:
    if isinstance(exc, TeacherProfileIncompleteError):
        return HTTPException(status_code=400, detail=str(exc))
    if isinstance(exc, teacher_grade_application_repository.TeacherGradeApplicationStateError):
        return HTTPException(status_code=409, detail=str(exc))
    if isinstance(exc, teacher_grade_application_repository.TeacherGradeApplicationNotFoundError):
        return HTTPException(status_code=404, detail=str(exc))
    raise exc


@router.post("", response_model=TeacherGradeApplicationResponse, status_code=201)
def create_teacher_grade_application(
    body: TeacherGradeApplicationCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """회원 — 지도자 등급 변경 신청."""
    try:
        application = teacher_grade_application_repository.create_application(db, current_user, body)
        db.commit()
    except (TeacherProfileIncompleteError, teacher_grade_application_repository.TeacherGradeApplicationStateError) as exc:
        db.rollback()
        raise _map_application_error(exc) from exc

    return TeacherGradeApplicationResponse.model_validate(
        teacher_grade_application_repository._to_response(application)
    )


@router.get("/me", response_model=Optional[TeacherGradeApplicationResponse])
def get_my_teacher_grade_application(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """회원 — 내 지도자 등급 신청 최신 상태."""
    application = teacher_grade_application_repository.get_latest_application_for_user(db, current_user.id)
    if not application:
        return None

    if application.user is None:
        application.user = current_user

    return TeacherGradeApplicationResponse.model_validate(
        teacher_grade_application_repository._to_response(application)
    )


@admin_router.get("", response_model=PaginatedResponse[TeacherGradeApplicationResponse])
def list_teacher_grade_applications(
    status: Optional[TeacherGradeApplicationStatus] = Query(None, description="pending | approved | rejected"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    page_size: int = Query(20, ge=1, le=100, description="페이지당 항목 수"),
    db: Session = Depends(get_db),
):
    """어드민 — 지도자 등급 신청 목록."""
    if page_size not in ALLOWED_PAGE_SIZES:
        raise HTTPException(
            status_code=422,
            detail="페이지당 항목 수는 10, 20, 50, 100 중 하나여야 합니다.",
        )

    items, total = teacher_grade_application_repository.list_applications_for_admin(
        db,
        status=status,
        page=page,
        page_size=page_size,
    )
    return PaginatedResponse[TeacherGradeApplicationResponse](
        items=[TeacherGradeApplicationResponse.model_validate(item) for item in items],
        page=page,
        page_size=page_size,
        total=total,
        total_pages=(total + page_size - 1) // page_size,
    )


@admin_router.post("/{application_id}/approve", response_model=TeacherGradeApplicationResponse)
def approve_teacher_grade_application(
    application_id: int,
    body: TeacherGradeApplicationReviewRequest,
    current_admin: AdminUser = Depends(require_roles(AdminRole.SUPERADMIN, AdminRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """어드민 — 지도자 등급 신청 승인."""
    try:
        application = teacher_grade_application_repository.approve_application(
            db,
            current_admin,
            application_id,
            body.review_note,
        )
        db.commit()
    except (
        TeacherProfileIncompleteError,
        teacher_grade_application_repository.TeacherGradeApplicationStateError,
        teacher_grade_application_repository.TeacherGradeApplicationNotFoundError,
    ) as exc:
        db.rollback()
        raise _map_application_error(exc) from exc

    return TeacherGradeApplicationResponse.model_validate(application)


@admin_router.post("/{application_id}/reject", response_model=TeacherGradeApplicationResponse)
def reject_teacher_grade_application(
    application_id: int,
    body: TeacherGradeApplicationReviewRequest,
    current_admin: AdminUser = Depends(require_roles(AdminRole.SUPERADMIN, AdminRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """어드민 — 지도자 등급 신청 반려."""
    try:
        application = teacher_grade_application_repository.reject_application(
            db,
            current_admin,
            application_id,
            body.review_note,
        )
        db.commit()
    except (
        teacher_grade_application_repository.TeacherGradeApplicationStateError,
        teacher_grade_application_repository.TeacherGradeApplicationNotFoundError,
    ) as exc:
        db.rollback()
        raise _map_application_error(exc) from exc

    return TeacherGradeApplicationResponse.model_validate(application)
