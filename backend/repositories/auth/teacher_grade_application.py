from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from core.teacher_policy import (
    TeacherProfileIncompleteError,
    validate_school_name,
    validate_teacher_contact_profile,
)
from db.models import AdminUser, TeacherGradeApplication, TeacherGradeApplicationStatus, User, UserGrade
from models.auth.teacher_grade_application import TeacherGradeApplicationCreateRequest


class TeacherGradeApplicationNotFoundError(Exception):
    def __init__(self, application_id: int):
        self.application_id = application_id
        super().__init__(f"지도자 등급 신청을 찾을 수 없습니다. (ID: {application_id})")


class TeacherGradeApplicationStateError(Exception):
    def __init__(self, message: str):
        super().__init__(message)


def _normalize_optional_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


def _to_response(application: TeacherGradeApplication) -> dict:
    user = application.user
    return {
        "id": application.id,
        "user_id": application.user_id,
        "user_login_id": user.login_id if user else None,
        "user_name": user.name if user else None,
        "user_email": user.email if user else None,
        "user_grade": user.grade if user else UserGrade.STUDENT,
        "school_name": application.school_name,
        "status": application.status,
        "review_note": application.review_note,
        "reviewed_at": application.reviewed_at,
        "created_at": application.created_at,
        "updated_at": application.updated_at,
    }


def ensure_teacher_contact_profile(user: User) -> tuple[str, str]:
    return validate_teacher_contact_profile(user.name, user.email)


def get_latest_application_for_user(db: Session, user_id: int) -> Optional[TeacherGradeApplication]:
    return db.scalar(
        select(TeacherGradeApplication)
        .options(selectinload(TeacherGradeApplication.user))
        .where(TeacherGradeApplication.user_id == user_id)
        .order_by(TeacherGradeApplication.created_at.desc())
        .limit(1)
    )


def get_pending_application_for_user(db: Session, user_id: int) -> Optional[TeacherGradeApplication]:
    return db.scalar(
        select(TeacherGradeApplication).where(
            TeacherGradeApplication.user_id == user_id,
            TeacherGradeApplication.status == TeacherGradeApplicationStatus.PENDING,
        )
    )


def create_application(
    db: Session,
    user: User,
    data: TeacherGradeApplicationCreateRequest,
) -> TeacherGradeApplication:
    if user.grade == UserGrade.TEACHER:
        raise TeacherGradeApplicationStateError("이미 지도자 등급입니다.")

    ensure_teacher_contact_profile(user)
    school_name = validate_school_name(data.school_name)

    pending = get_pending_application_for_user(db, user.id)
    if pending:
        raise TeacherGradeApplicationStateError("이미 검토 중인 지도자 등급 신청이 있습니다.")

    application = TeacherGradeApplication(
        user_id=user.id,
        school_name=school_name,
        status=TeacherGradeApplicationStatus.PENDING,
    )
    db.add(application)
    db.flush()
    db.refresh(application)
    application.user = user
    return application


def list_applications_for_admin(
    db: Session,
    *,
    status: Optional[TeacherGradeApplicationStatus] = None,
    page: int = 1,
    page_size: int = 20,
) -> Tuple[List[dict], int]:
    query = select(TeacherGradeApplication).options(selectinload(TeacherGradeApplication.user))
    if status is not None:
        query = query.where(TeacherGradeApplication.status == status)

    total_query = select(func.count()).select_from(TeacherGradeApplication)
    if status is not None:
        total_query = total_query.where(TeacherGradeApplication.status == status)
    total = db.scalar(total_query) or 0
    applications = db.scalars(
        query.order_by(TeacherGradeApplication.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return [_to_response(application) for application in applications], total


def _get_application_or_raise(db: Session, application_id: int) -> TeacherGradeApplication:
    application = db.scalar(
        select(TeacherGradeApplication)
        .options(selectinload(TeacherGradeApplication.user))
        .where(TeacherGradeApplication.id == application_id)
    )
    if not application:
        raise TeacherGradeApplicationNotFoundError(application_id)
    return application


def approve_application(db: Session, admin_user: AdminUser, application_id: int, review_note: Optional[str]) -> dict:
    application = _get_application_or_raise(db, application_id)
    if application.status != TeacherGradeApplicationStatus.PENDING:
        raise TeacherGradeApplicationStateError("검토 대기 중인 신청만 승인할 수 있습니다.")

    user = application.user
    if user is None:
        raise TeacherGradeApplicationStateError("신청 회원 정보를 찾을 수 없습니다.")
    if user.grade == UserGrade.TEACHER:
        raise TeacherGradeApplicationStateError("이미 지도자 등급인 회원입니다.")

    ensure_teacher_contact_profile(user)

    user.grade = UserGrade.TEACHER
    application.status = TeacherGradeApplicationStatus.APPROVED
    application.reviewer_admin_id = admin_user.id
    application.review_note = _normalize_optional_text(review_note)
    application.reviewed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.flush()
    db.refresh(application)
    return _to_response(application)


def reject_application(db: Session, admin_user: AdminUser, application_id: int, review_note: Optional[str]) -> dict:
    application = _get_application_or_raise(db, application_id)
    if application.status != TeacherGradeApplicationStatus.PENDING:
        raise TeacherGradeApplicationStateError("검토 대기 중인 신청만 반려할 수 있습니다.")

    application.status = TeacherGradeApplicationStatus.REJECTED
    application.reviewer_admin_id = admin_user.id
    application.review_note = _normalize_optional_text(review_note)
    application.reviewed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.flush()
    db.refresh(application)
    return _to_response(application)
