from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from core.class_policy import (
    InvalidClassNameError,
    build_entry_code,
    normalize_class_name,
)
from db.models import ClassMembership, ClassRoom, User, UserGrade


class ClassRoomNotFoundError(Exception):
    def __init__(self, class_id: int):
        self.class_id = class_id
        super().__init__(f"클래스를 찾을 수 없습니다. (ID: {class_id})")


class ClassRoomForbiddenError(Exception):
    def __init__(self):
        super().__init__("해당 클래스에 접근할 수 없습니다.")


class ClassRoomTeacherRequiredError(Exception):
    def __init__(self):
        super().__init__("지도자만 클래스를 관리할 수 있습니다.")


class ClassRoomDuplicateEntryCodeError(Exception):
    def __init__(self, entry_code: str):
        self.entry_code = entry_code
        super().__init__(f"이미 사용 중인 입장코드입니다. ({entry_code})")


def _count_active_members(db: Session, class_id: int) -> int:
    return (
        db.scalar(
            select(func.count(ClassMembership.id)).where(
                ClassMembership.class_id == class_id,
                ClassMembership.is_active.is_(True),
            )
        )
        or 0
    )


def _to_response(class_room: ClassRoom, member_count: int) -> dict:
    return {
        "id": class_room.id,
        "teacher_user_id": class_room.teacher_user_id,
        "name": class_room.name,
        "entry_code": class_room.entry_code,
        "is_active": class_room.is_active,
        "member_count": member_count,
        "created_at": class_room.created_at,
        "updated_at": class_room.updated_at,
    }


def _to_admin_response(class_room: ClassRoom, teacher: Optional[User], member_count: int) -> dict:
    return {
        **_to_response(class_room, member_count),
        "teacher_login_id": teacher.login_id if teacher else None,
        "teacher_name": teacher.name if teacher else None,
        "teacher_email": teacher.email if teacher else None,
    }


def _ensure_unique_entry_code(db: Session, entry_code: str) -> None:
    existing = db.scalar(select(ClassRoom.id).where(ClassRoom.entry_code == entry_code))
    if existing:
        raise ClassRoomDuplicateEntryCodeError(entry_code)


def _get_class_for_teacher_or_raise(db: Session, teacher_user_id: int, class_id: int) -> ClassRoom:
    class_room = db.scalar(
        select(ClassRoom)
        .options(selectinload(ClassRoom.memberships))
        .where(ClassRoom.id == class_id, ClassRoom.teacher_user_id == teacher_user_id)
    )
    if not class_room:
        raise ClassRoomNotFoundError(class_id)
    return class_room


def ensure_teacher_user(user: User) -> None:
    if user.grade != UserGrade.TEACHER:
        raise ClassRoomTeacherRequiredError()


def list_classes_for_teacher(
    db: Session,
    teacher_user_id: int,
    *,
    name: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> Tuple[List[dict], int]:
    query = select(ClassRoom).where(ClassRoom.teacher_user_id == teacher_user_id)
    if name:
        query = query.where(ClassRoom.name.ilike(f"%{name}%"))

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    classes = db.scalars(
        query.order_by(ClassRoom.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return [
        _to_response(class_room, _count_active_members(db, class_room.id)) for class_room in classes
    ], total


def get_class_for_teacher(db: Session, teacher_user_id: int, class_id: int) -> dict:
    class_room = _get_class_for_teacher_or_raise(db, teacher_user_id, class_id)
    return _to_response(class_room, _count_active_members(db, class_room.id))


def _to_member_response(membership: ClassMembership, user: User) -> dict:
    return {
        "membership_id": membership.id,
        "user_id": user.id,
        "login_id": user.login_id,
        "name": user.name,
        "nickname": user.nickname,
        "joined_at": membership.joined_at,
        "is_active": membership.is_active,
    }


def _list_members_for_class(db: Session, class_id: int) -> List[dict]:
    memberships = db.scalars(
        select(ClassMembership)
        .where(ClassMembership.class_id == class_id)
        .options(selectinload(ClassMembership.user))
        .order_by(ClassMembership.joined_at.desc())
    ).all()
    return [
        _to_member_response(membership, membership.user)
        for membership in memberships
        if membership.user is not None and membership.user.deleted_at is None
    ]


def get_class_detail_for_teacher(db: Session, teacher_user_id: int, class_id: int) -> dict:
    class_room = _get_class_for_teacher_or_raise(db, teacher_user_id, class_id)
    return {
        **_to_response(class_room, _count_active_members(db, class_room.id)),
        "members": _list_members_for_class(db, class_id),
    }


def create_class(db: Session, teacher: User, name: str, entry_code_suffix: str) -> dict:
    ensure_teacher_user(teacher)
    normalized_name = normalize_class_name(name)
    entry_code = build_entry_code(entry_code_suffix)
    _ensure_unique_entry_code(db, entry_code)

    class_room = ClassRoom(
        teacher_user_id=teacher.id,
        name=normalized_name,
        entry_code=entry_code,
        is_active=True,
    )
    db.add(class_room)
    db.flush()
    db.refresh(class_room)
    return _to_response(class_room, 0)


def update_class(
    db: Session,
    teacher: User,
    class_id: int,
    *,
    name: Optional[str] = None,
    is_active: Optional[bool] = None,
) -> dict:
    ensure_teacher_user(teacher)
    class_room = _get_class_for_teacher_or_raise(db, teacher.id, class_id)

    if name is not None:
        class_room.name = normalize_class_name(name)
    if is_active is not None:
        class_room.is_active = is_active

    db.flush()
    db.refresh(class_room)
    return _to_response(class_room, _count_active_members(db, class_room.id))


def delete_class(db: Session, teacher: User, class_id: int) -> dict:
    ensure_teacher_user(teacher)
    class_room = _get_class_for_teacher_or_raise(db, teacher.id, class_id)
    member_count = _count_active_members(db, class_room.id)
    response = _to_response(class_room, member_count)
    db.delete(class_room)
    db.flush()
    return response


def _get_class_or_raise(db: Session, class_id: int) -> ClassRoom:
    class_room = db.scalar(
        select(ClassRoom)
        .options(selectinload(ClassRoom.teacher))
        .where(ClassRoom.id == class_id)
    )
    if not class_room:
        raise ClassRoomNotFoundError(class_id)
    return class_room


def list_classes_for_admin(
    db: Session,
    *,
    is_active: Optional[bool] = None,
    teacher_login_id: Optional[str] = None,
    name: Optional[str] = None,
    entry_code: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> Tuple[List[dict], int]:
    query = select(ClassRoom).join(User, ClassRoom.teacher_user_id == User.id)
    conditions = [User.deleted_at.is_(None)]

    if is_active is not None:
        conditions.append(ClassRoom.is_active == is_active)
    if teacher_login_id:
        conditions.append(User.login_id.ilike(f"%{teacher_login_id}%"))
    if name:
        conditions.append(ClassRoom.name.ilike(f"%{name}%"))
    if entry_code:
        conditions.append(ClassRoom.entry_code.ilike(f"%{entry_code}%"))

    query = query.where(*conditions)

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    classes = db.scalars(
        query.options(selectinload(ClassRoom.teacher))
        .order_by(ClassRoom.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    return [
        _to_admin_response(class_room, class_room.teacher, _count_active_members(db, class_room.id))
        for class_room in classes
    ], total


def get_class_for_admin(db: Session, class_id: int) -> dict:
    class_room = _get_class_or_raise(db, class_id)
    return _to_admin_response(
        class_room,
        class_room.teacher,
        _count_active_members(db, class_room.id),
    )


def get_class_detail_for_admin(db: Session, class_id: int) -> dict:
    class_room = _get_class_or_raise(db, class_id)
    return {
        **_to_admin_response(
            class_room,
            class_room.teacher,
            _count_active_members(db, class_room.id),
        ),
        "members": _list_members_for_class(db, class_id),
    }
