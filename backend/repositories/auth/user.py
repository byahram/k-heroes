from datetime import date, datetime, time, timezone
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from core.auth_policy import (
    InvalidLoginIdError,
    build_google_login_id,
    validate_login_id,
    validate_optional_email,
)
from core.security import hash_password, verify_password
from db.models import AuthProvider, PlaySession, User, UserGrade
from models.auth.user import AdminMemberResponse
from repositories.classroom import classroom as classroom_repository
from repositories.simulation.content import resolve_play_session_choices_history
from models.auth.user import (
    AdminMemberUpdate,
    AdminPlaySessionItem,
    UserLoginRequest,
    UserPlaySessionItem,
    UserSignupRequest,
    UserUpdateRequest,
)


class UserNotFoundError(Exception):
    def __init__(self, user_id: int):
        self.user_id = user_id
        super().__init__(f"회원 계정을 찾을 수 없습니다. (ID: {user_id})")


class UserDuplicateError(Exception):
    def __init__(self, field_name: str, value: str):
        self.field_name = field_name
        self.value = value
        super().__init__(f"이미 사용 중인 {field_name}입니다. ({value})")


def _to_user_play_session_item(session: PlaySession) -> UserPlaySessionItem:
    return UserPlaySessionItem(
        id=session.id,
        scenario_id=session.scenario_id,
        ending_id=session.ending_id,
        character_name=session.character_name,
        scenario_title=session.scenario_title,
        scenario_sort_order=session.scenario.sort_order if session.scenario else None,
        status=session.status,
        history_score=session.history_score,
        choices_path=session.choices_path or [],
        choices_history=resolve_play_session_choices_history(session),
        created_at=session.created_at,
        completed_at=session.completed_at,
    )


def _to_admin_play_session_item(session: PlaySession) -> AdminPlaySessionItem:
    return AdminPlaySessionItem(
        id=session.id,
        user_id=session.user.id if session.user else None,
        user_login_id=session.user.login_id if session.user else None,
        user_name=session.user.name if session.user else None,
        user_grade=session.user.grade if session.user else None,
        scenario_id=session.scenario_id,
        ending_id=session.ending_id,
        scenario_title=session.scenario_title,
        scenario_sort_order=session.scenario.sort_order if session.scenario else None,
        character_name=session.character_name,
        status=session.status,
        history_score=session.history_score,
        choices_path=session.choices_path or [],
        choices_history=resolve_play_session_choices_history(session),
        created_at=session.created_at,
        completed_at=session.completed_at,
        completed_date=session.completed_at.date().isoformat() if session.completed_at else None,
    )


def _get_active_user_or_raise(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if not user or user.deleted_at is not None:
        raise UserNotFoundError(user_id)
    return user


def _get_user_or_raise(db: Session, user_id: int) -> User:
    return _get_active_user_or_raise(db, user_id)


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.get(User, user_id)


def get_user_by_login_id(db: Session, login_id: str) -> Optional[User]:
    return db.scalar(
        select(User).where(User.login_id == login_id, User.deleted_at.is_(None))
    )


def _ensure_unique_login_id(db: Session, login_id: str) -> None:
    if get_user_by_login_id(db, login_id):
        raise UserDuplicateError("login_id", login_id)


def _ensure_unique_email(db: Session, email: str, *, exclude_user_id: Optional[int] = None) -> None:
    query = select(User).where(User.email == email, User.deleted_at.is_(None))
    if exclude_user_id is not None:
        query = query.where(User.id != exclude_user_id)
    existing = db.scalar(query)
    if existing:
        raise UserDuplicateError("email", email)


def get_user_by_google_provider_user_id(db: Session, provider_user_id: str) -> Optional[User]:
    return db.scalar(
        select(User).where(
            User.auth_provider == AuthProvider.GOOGLE,
            User.provider_user_id == provider_user_id,
            User.deleted_at.is_(None),
        )
    )


def _resolve_google_login_id(db: Session, provider_user_id: str, *, exclude_user_id: Optional[int] = None) -> str:
    login_id = build_google_login_id(provider_user_id)
    existing = get_user_by_login_id(db, login_id)
    if existing and existing.id != exclude_user_id:
        raise UserDuplicateError("login_id", login_id)
    return login_id


def _ensure_google_login_id(db: Session, user: User, provider_user_id: str) -> None:
    if user.login_id:
        return
    user.login_id = _resolve_google_login_id(db, provider_user_id, exclude_user_id=user.id)


def create_local_user(db: Session, data: UserSignupRequest) -> User:
    login_id = validate_login_id(data.login_id)
    email = validate_optional_email(data.email)
    _ensure_unique_login_id(db, login_id)
    if email:
        _ensure_unique_email(db, email)

    user = User(
        auth_provider=AuthProvider.LOCAL,
        provider_user_id=None,
        login_id=login_id,
        name=data.name,
        email=email,
        password_hash=hash_password(data.password),
        nickname=data.nickname,
        grade=UserGrade.STUDENT,
    )
    db.add(user)
    db.flush()
    db.refresh(user)
    return user


def authenticate_local_user(db: Session, body: UserLoginRequest) -> User:
    login_id = validate_login_id(body.login_id)
    user = get_user_by_login_id(db, login_id)
    if not user or user.auth_provider != AuthProvider.LOCAL:
        raise ValueError("invalid credentials")
    if not user.password_hash or not verify_password(body.password, user.password_hash):
        raise ValueError("invalid credentials")
    return user


def authenticate_google_user(
    db: Session,
    *,
    provider_user_id: str,
    email: Optional[str] = None,
    name: Optional[str] = None,
) -> User:
    user = get_user_by_google_provider_user_id(db, provider_user_id)
    if user:
        _ensure_google_login_id(db, user, provider_user_id)
        if name and not user.name:
            user.name = name
        if email and not user.email:
            existing_email_user = db.scalar(
                select(User).where(
                    User.email == email,
                    User.id != user.id,
                    User.deleted_at.is_(None),
                )
            )
            if not existing_email_user:
                user.email = email
        if name and not user.nickname:
            user.nickname = name
        db.flush()
        db.refresh(user)
        return user

    stored_email = email
    if stored_email:
        existing_email_user = db.scalar(
            select(User).where(User.email == stored_email, User.deleted_at.is_(None))
        )
        if existing_email_user:
            stored_email = None

    user = User(
        auth_provider=AuthProvider.GOOGLE,
        provider_user_id=provider_user_id,
        login_id=_resolve_google_login_id(db, provider_user_id),
        name=name,
        email=stored_email,
        password_hash=None,
        nickname=name,
        grade=UserGrade.STUDENT,
    )
    db.add(user)
    db.flush()
    db.refresh(user)
    return user


def _normalize_optional_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


def update_current_user(db: Session, user: User, data: UserUpdateRequest) -> User:
    updates = data.model_dump(exclude_unset=True)

    if user.auth_provider == AuthProvider.GOOGLE and (
        "current_password" in updates or "new_password" in updates
    ):
        raise ValueError("password change not allowed")

    if user.auth_provider == AuthProvider.GOOGLE and "email" in updates:
        raise ValueError("google email change not allowed")

    if user.auth_provider == AuthProvider.LOCAL and (
        "current_password" in updates or "new_password" in updates
    ):
        current_password = updates.pop("current_password", None)
        new_password = updates.pop("new_password", None)
        if not current_password or not new_password:
            raise ValueError("password change requires current and new password")
        if not user.password_hash or not verify_password(current_password, user.password_hash):
            raise ValueError("invalid current password")
        user.password_hash = hash_password(new_password)

    if "name" in updates:
        user.name = _normalize_optional_text(updates.pop("name"))
    if "nickname" in updates:
        user.nickname = _normalize_optional_text(updates.pop("nickname"))
    if "email" in updates:
        new_email = validate_optional_email(updates.pop("email"))
        if new_email != user.email:
            if new_email:
                _ensure_unique_email(db, new_email, exclude_user_id=user.id)
            user.email = new_email

    db.flush()
    db.refresh(user)
    return user


def get_play_session_summary_for_user(db: Session, user_id: int) -> dict:
    conditions = [PlaySession.user_id == user_id, PlaySession.status == "completed"]
    total = db.scalar(select(func.count(PlaySession.id)).where(*conditions)) or 0
    average_history_score = db.scalar(
        select(func.avg(PlaySession.history_score)).where(*conditions)
    )
    return {
        "completed_count": total,
        "average_history_score": (
            float(average_history_score) if average_history_score is not None else None
        ),
    }


def list_play_sessions_for_user_admin(
    db: Session,
    user_id: int,
    *,
    page: int = 1,
    page_size: int = 5,
) -> Tuple[List[UserPlaySessionItem], int, Optional[float]]:
    return list_completed_play_sessions(
        db,
        user_id,
        page=page,
        page_size=page_size,
    )


def list_completed_play_sessions(
    db: Session,
    user_id: int,
    *,
    page: int = 1,
    page_size: int = 20,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    character_name: Optional[str] = None,
    scenario_title: Optional[str] = None,
) -> Tuple[List[UserPlaySessionItem], int, Optional[float]]:
    conditions = [PlaySession.user_id == user_id, PlaySession.status == "completed"]

    if date_from is not None:
        conditions.append(PlaySession.completed_at >= datetime.combine(date_from, time.min))
    if date_to is not None:
        conditions.append(PlaySession.completed_at <= datetime.combine(date_to, time.max))
    if character_name:
        conditions.append(PlaySession.character_name.contains(character_name))
    if scenario_title:
        conditions.append(PlaySession.scenario_title.contains(scenario_title))

    total = db.scalar(
        select(func.count(PlaySession.id)).where(*conditions)
    ) or 0
    average_history_score = db.scalar(
        select(func.avg(PlaySession.history_score)).where(*conditions)
    )

    sessions = db.scalars(
        select(PlaySession)
        .options(selectinload(PlaySession.scenario))
        .where(*conditions)
        .order_by(PlaySession.completed_at.desc().nullslast(), PlaySession.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return (
        [_to_user_play_session_item(session) for session in sessions],
        total,
        float(average_history_score) if average_history_score is not None else None,
    )


def list_play_sessions_for_admin(
    db: Session,
    *,
    page: int = 1,
    page_size: int = 20,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    status: Optional[str] = None,
    user_login_id: Optional[str] = None,
    character_name: Optional[str] = None,
    scenario_title: Optional[str] = None,
) -> Tuple[List[AdminPlaySessionItem], int]:
    conditions = []
    if date_from is not None:
        conditions.append(PlaySession.completed_at >= datetime.combine(date_from, time.min))
    if date_to is not None:
        conditions.append(PlaySession.completed_at <= datetime.combine(date_to, time.max))
    if status:
        conditions.append(PlaySession.status == status)
    if character_name:
        conditions.append(PlaySession.character_name.contains(character_name))
    if scenario_title:
        conditions.append(PlaySession.scenario_title.contains(scenario_title))
    if user_login_id:
        conditions.append(User.login_id.contains(user_login_id))

    total = (
        db.scalar(
            select(func.count(PlaySession.id))
            .select_from(PlaySession)
            .join(User, PlaySession.user_id == User.id, isouter=True)
            .where(*conditions)
        )
        or 0
    )

    sessions = db.scalars(
        select(PlaySession)
        .options(selectinload(PlaySession.user), selectinload(PlaySession.scenario))
        .join(User, PlaySession.user_id == User.id, isouter=True)
        .where(*conditions)
        .order_by(PlaySession.completed_at.desc().nullslast(), PlaySession.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    items = [_to_admin_play_session_item(session) for session in sessions]
    return items, total


def list_users_for_admin(
    db: Session,
    *,
    grade: Optional[UserGrade] = None,
    auth_provider: Optional[AuthProvider] = None,
    login_id: Optional[str] = None,
    name: Optional[str] = None,
    email: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> Tuple[List[User], int]:
    conditions = [User.deleted_at.is_(None)]
    if grade is not None:
        conditions.append(User.grade == grade)
    if auth_provider is not None:
        conditions.append(User.auth_provider == auth_provider)
    if login_id:
        conditions.append(User.login_id.ilike(f"%{login_id}%"))
    if name:
        conditions.append(User.name.ilike(f"%{name}%"))
    if email:
        conditions.append(User.email.ilike(f"%{email}%"))

    total = db.scalar(select(func.count(User.id)).where(*conditions)) or 0
    users = db.scalars(
        select(User)
        .where(*conditions)
        .order_by(User.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return list(users), total


def get_user_for_admin_by_id(db: Session, user_id: int) -> User:
    return _get_active_user_or_raise(db, user_id)


def get_user_detail_for_admin(db: Session, user_id: int) -> dict:
    user = _get_active_user_or_raise(db, user_id)
    return {
        **AdminMemberResponse.model_validate(user).model_dump(),
        "classes": classroom_repository.list_classes_for_user_admin(db, user),
        "play_session_summary": get_play_session_summary_for_user(db, user_id),
    }


def update_user_by_admin(db: Session, user_id: int, data: AdminMemberUpdate) -> User:
    user = _get_active_user_or_raise(db, user_id)
    updates = data.model_dump(exclude_unset=True)

    if user.auth_provider == AuthProvider.GOOGLE and "password" in updates:
        raise ValueError("password change not allowed")

    if "password" in updates:
        password = updates.pop("password")
        if user.auth_provider != AuthProvider.LOCAL:
            raise ValueError("password change not allowed")
        if password:
            user.password_hash = hash_password(password)

    if "name" in updates:
        user.name = _normalize_optional_text(updates.pop("name"))
    if "nickname" in updates:
        user.nickname = _normalize_optional_text(updates.pop("nickname"))
    if "email" in updates:
        new_email = validate_optional_email(updates.pop("email"))
        if user.auth_provider == AuthProvider.GOOGLE:
            if new_email is not None and new_email != user.email:
                raise ValueError("google email change not allowed")
        elif new_email != user.email:
            if new_email:
                _ensure_unique_email(db, new_email, exclude_user_id=user.id)
            user.email = new_email
    if "grade" in updates:
        user.grade = updates.pop("grade")

    db.flush()
    db.refresh(user)
    return user


def delete_user_by_admin(db: Session, user_id: int) -> User:
    user = _get_active_user_or_raise(db, user_id)
    user.deleted_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.flush()
    db.refresh(user)
    return user
