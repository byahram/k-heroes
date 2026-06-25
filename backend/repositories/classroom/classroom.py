from collections import defaultdict
from datetime import date, datetime, time
from typing import List, Optional, Tuple

from sqlalchemy import distinct, func, select
from sqlalchemy.orm import Session, selectinload

from core.class_policy import (
    InvalidClassNameError,
    build_entry_code,
    normalize_class_name,
    normalize_entry_code,
)
from db.models import ClassMembership, ClassRoom, PlaySession, Scenario, User, UserGrade


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


class ClassRoomEntryCodeNotFoundError(Exception):
    def __init__(self):
        super().__init__("입장코드를 찾을 수 없습니다.")


class ClassRoomInactiveError(Exception):
    def __init__(self):
        super().__init__("비활성화된 클래스입니다. 선생님에게 문의해 주세요.")


class ClassRoomAlreadyMemberError(Exception):
    def __init__(self):
        super().__init__("이미 가입한 클래스입니다.")


class ClassRoomStudentRequiredError(Exception):
    def __init__(self):
        super().__init__("학생만 클래스에 가입할 수 있습니다.")


class ClassCharacterRecordInvalidIdError(Exception):
    def __init__(self, record_id: str):
        self.record_id = record_id
        super().__init__(f"인물 기록 ID 형식이 올바르지 않습니다. ({record_id})")


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


def ensure_student_user(user: User) -> None:
    if user.grade != UserGrade.STUDENT:
        raise ClassRoomStudentRequiredError()


def _to_student_class_response(membership: ClassMembership, class_room: ClassRoom) -> dict:
    return {
        "membership_id": membership.id,
        "class_id": class_room.id,
        "class_name": class_room.name,
        "entry_code": class_room.entry_code,
        "joined_at": membership.joined_at,
        "is_class_active": class_room.is_active,
    }


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


def _build_class_members_query(
    class_id: int,
    *,
    name: Optional[str] = None,
    nickname: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
):
    query = (
        select(ClassMembership)
        .join(User, ClassMembership.user_id == User.id)
        .where(
            ClassMembership.class_id == class_id,
            ClassMembership.is_active.is_(True),
            User.deleted_at.is_(None),
        )
        .options(selectinload(ClassMembership.user))
    )
    if name:
        query = query.where(User.name.ilike(f"%{name}%"))
    if nickname:
        query = query.where(User.nickname.ilike(f"%{nickname}%"))
    if date_from is not None or date_to is not None:
        session_user_ids_query = select(distinct(PlaySession.user_id)).where(
            PlaySession.status == "completed"
        )
        if date_from is not None:
            session_user_ids_query = session_user_ids_query.where(
                PlaySession.completed_at >= datetime.combine(date_from, time.min)
            )
        if date_to is not None:
            session_user_ids_query = session_user_ids_query.where(
                PlaySession.completed_at <= datetime.combine(date_to, time.max)
            )
        query = query.where(ClassMembership.user_id.in_(session_user_ids_query))
    return query


def get_class_detail_for_teacher(db: Session, teacher_user_id: int, class_id: int) -> dict:
    class_room = _get_class_for_teacher_or_raise(db, teacher_user_id, class_id)
    return {
        **_to_response(class_room, _count_active_members(db, class_room.id)),
        "members": _list_members_for_class(db, class_id),
    }


def get_class_activity_summary_for_teacher(
    db: Session,
    teacher_user_id: int,
    class_id: int,
    *,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> dict:
    class_room = _get_class_for_teacher_or_raise(db, teacher_user_id, class_id)
    conditions = [
        ClassMembership.class_id == class_room.id,
        ClassMembership.is_active.is_(True),
        PlaySession.user_id == ClassMembership.user_id,
        PlaySession.status == "completed",
    ]

    if date_from is not None:
        conditions.append(PlaySession.completed_at >= datetime.combine(date_from, time.min))
    if date_to is not None:
        conditions.append(PlaySession.completed_at <= datetime.combine(date_to, time.max))

    participating_students, completed_sessions, average_history_score = db.execute(
        select(
            func.count(distinct(PlaySession.user_id)),
            func.count(PlaySession.id),
            func.avg(PlaySession.history_score),
        )
        .select_from(PlaySession)
        .join(ClassMembership, PlaySession.user_id == ClassMembership.user_id)
        .where(*conditions)
    ).one()

    return {
        "total_students": _count_active_members(db, class_room.id),
        "participating_students": int(participating_students or 0),
        "completed_sessions": int(completed_sessions or 0),
        "average_history_score": (
            float(average_history_score) if average_history_score is not None else None
        ),
    }


def _to_class_student_play_session(session: PlaySession, user: User) -> dict:
    return {
        "id": session.id,
        "student_login_id": user.login_id,
        "student_name": user.name,
        "student_nickname": user.nickname,
        "character_name": session.character_name,
        "scenario_title": session.scenario_title,
        "scenario_sort_order": session.scenario.sort_order if session.scenario else None,
        "history_score": session.history_score,
        "completed_at": session.completed_at,
    }


def _build_student_session_summary(
    membership: ClassMembership,
    user: User,
    sessions: List[dict],
) -> dict:
    total_score = sum(session["history_score"] for session in sessions)
    return {
        "membership_id": membership.id,
        "user_id": user.id,
        "login_id": user.login_id,
        "name": user.name,
        "nickname": user.nickname,
        "joined_at": membership.joined_at,
        "completed_count": len(sessions),
        "average_history_score": total_score / len(sessions) if sessions else None,
        "latest_completed_at": sessions[0]["completed_at"] if sessions else None,
        "sessions": sessions,
    }


def list_class_members_for_teacher(
    db: Session,
    teacher_user_id: int,
    class_id: int,
    *,
    name: Optional[str] = None,
    nickname: Optional[str] = None,
) -> List[dict]:
    _get_class_for_teacher_or_raise(db, teacher_user_id, class_id)

    memberships = db.scalars(
        _build_class_members_query(
            class_id,
            name=name,
            nickname=nickname,
        ).order_by(ClassMembership.joined_at.desc())
    ).all()

    return [
        _to_member_response(membership, membership.user)
        for membership in memberships
        if membership.user is not None
    ]


def _load_sessions_by_user_ids(
    db: Session,
    user_ids: List[int],
    *,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    user_by_id: Optional[dict[int, User]] = None,
) -> dict[int, List[dict]]:
    sessions_by_user: dict[int, List[dict]] = defaultdict(list)
    if not user_ids:
        return sessions_by_user

    session_conditions = [
        PlaySession.user_id.in_(user_ids),
        PlaySession.status == "completed",
    ]
    if date_from is not None:
        session_conditions.append(PlaySession.completed_at >= datetime.combine(date_from, time.min))
    if date_to is not None:
        session_conditions.append(PlaySession.completed_at <= datetime.combine(date_to, time.max))

    sessions = db.scalars(
        select(PlaySession)
        .options(selectinload(PlaySession.scenario))
        .where(*session_conditions)
        .order_by(PlaySession.completed_at.desc().nullslast(), PlaySession.created_at.desc())
    ).all()

    if user_by_id is None:
        user_by_id = {
            user.id: user
            for user in db.scalars(select(User).where(User.id.in_(user_ids), User.deleted_at.is_(None))).all()
        }

    for session in sessions:
        user = user_by_id.get(session.user_id)
        if user is None:
            continue
        sessions_by_user[session.user_id].append(_to_class_student_play_session(session, user))

    return sessions_by_user


def list_student_sessions_for_teacher(
    db: Session,
    teacher_user_id: int,
    class_id: int,
    *,
    name: Optional[str] = None,
    nickname: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    page: int = 1,
    page_size: int = 10,
) -> Tuple[List[dict], int]:
    _get_class_for_teacher_or_raise(db, teacher_user_id, class_id)
    query = _build_class_members_query(
        class_id,
        name=name,
        nickname=nickname,
        date_from=date_from,
        date_to=date_to,
    )
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    memberships = db.scalars(
        query.order_by(ClassMembership.joined_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    user_ids = [membership.user_id for membership in memberships]
    user_by_id = {
        membership.user_id: membership.user for membership in memberships if membership.user is not None
    }
    sessions_by_user = _load_sessions_by_user_ids(
        db,
        user_ids,
        date_from=date_from,
        date_to=date_to,
        user_by_id=user_by_id,
    )

    items = [
        _build_student_session_summary(
            membership,
            membership.user,
            sessions_by_user.get(membership.user_id, []),
        )
        for membership in memberships
        if membership.user is not None
    ]
    return items, total


def list_student_sessions_for_teacher_export(
    db: Session,
    teacher_user_id: int,
    class_id: int,
    *,
    name: Optional[str] = None,
    nickname: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> List[dict]:
    _get_class_for_teacher_or_raise(db, teacher_user_id, class_id)

    memberships = db.scalars(
        _build_class_members_query(
            class_id,
            name=name,
            nickname=nickname,
            date_from=date_from,
            date_to=date_to,
        ).order_by(ClassMembership.joined_at.desc())
    ).all()
    user_by_id = {
        membership.user_id: membership.user for membership in memberships if membership.user is not None
    }
    sessions_by_user = _load_sessions_by_user_ids(
        db,
        [membership.user_id for membership in memberships],
        date_from=date_from,
        date_to=date_to,
        user_by_id=user_by_id,
    )

    return [
        _build_student_session_summary(
            membership,
            membership.user,
            sessions_by_user.get(membership.user_id, []),
        )
        for membership in memberships
        if membership.user is not None
    ]


def _build_character_record_id(
    character_name: str,
    scenario_title: str,
    scenario_sort_order: Optional[int],
) -> str:
    suffix = scenario_sort_order if scenario_sort_order is not None else scenario_title
    return f"{character_name}::{suffix}"


def _parse_character_record_id(record_id: str) -> Tuple[str, Optional[int], Optional[str]]:
    if "::" not in record_id:
        raise ClassCharacterRecordInvalidIdError(record_id)
    character_name, suffix = record_id.split("::", 1)
    if not character_name or not suffix:
        raise ClassCharacterRecordInvalidIdError(record_id)
    if suffix.isdigit():
        return character_name, int(suffix), None
    return character_name, None, suffix


def _character_record_match_conditions(
    character_name: str,
    scenario_sort_order: Optional[int],
    scenario_title: Optional[str],
) -> list:
    conditions = [PlaySession.character_name == character_name]
    if scenario_sort_order is not None:
        conditions.append(Scenario.sort_order == scenario_sort_order)
    else:
        conditions.append(PlaySession.scenario_title == scenario_title)
        conditions.append(Scenario.sort_order.is_(None))
    return conditions


def _character_record_group_conditions(
    class_id: int,
    *,
    character_name: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> list:
    conditions = [
        ClassMembership.class_id == class_id,
        ClassMembership.is_active.is_(True),
        User.deleted_at.is_(None),
        PlaySession.user_id == User.id,
        PlaySession.status == "completed",
    ]
    if character_name:
        conditions.append(PlaySession.character_name.ilike(f"%{character_name}%"))
    if date_from is not None:
        conditions.append(PlaySession.completed_at >= datetime.combine(date_from, time.min))
    if date_to is not None:
        conditions.append(PlaySession.completed_at <= datetime.combine(date_to, time.max))
    return conditions


def _build_character_records_grouped_subquery(
    class_id: int,
    *,
    character_name: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
):
    conditions = _character_record_group_conditions(
        class_id,
        character_name=character_name,
        date_from=date_from,
        date_to=date_to,
    )

    return (
        select(
            PlaySession.character_name.label("character_name"),
            PlaySession.scenario_title.label("scenario_title"),
            Scenario.sort_order.label("scenario_sort_order"),
            func.avg(PlaySession.history_score).label("average_history_score"),
            func.count(distinct(PlaySession.user_id)).label("completed_student_count"),
        )
        .select_from(PlaySession)
        .join(User, PlaySession.user_id == User.id)
        .join(ClassMembership, ClassMembership.user_id == User.id)
        .outerjoin(Scenario, PlaySession.scenario_id == Scenario.id)
        .where(*conditions)
        .group_by(
            PlaySession.character_name,
            PlaySession.scenario_title,
            Scenario.sort_order,
        )
        .subquery()
    )


def list_character_records_for_teacher(
    db: Session,
    teacher_user_id: int,
    class_id: int,
    *,
    character_name: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    page: int = 1,
    page_size: int = 10,
) -> Tuple[List[dict], int]:
    class_room = _get_class_for_teacher_or_raise(db, teacher_user_id, class_id)
    total_student_count = _count_active_members(db, class_room.id)
    grouped_subquery = _build_character_records_grouped_subquery(
        class_id,
        character_name=character_name,
        date_from=date_from,
        date_to=date_to,
    )

    total = db.scalar(select(func.count()).select_from(grouped_subquery)) or 0

    rows = db.execute(
        select(grouped_subquery)
        .order_by(
            grouped_subquery.c.character_name.asc(),
            grouped_subquery.c.scenario_sort_order.asc().nullslast(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    items = [
        {
            "id": _build_character_record_id(
                row.character_name,
                row.scenario_title,
                row.scenario_sort_order,
            ),
            "character_name": row.character_name,
            "scenario_title": row.scenario_title,
            "scenario_sort_order": row.scenario_sort_order,
            "average_history_score": float(row.average_history_score),
            "completed_student_count": int(row.completed_student_count),
            "total_student_count": total_student_count,
        }
        for row in rows
    ]
    return items, total


def list_character_records_for_teacher_export(
    db: Session,
    teacher_user_id: int,
    class_id: int,
    *,
    character_name: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> List[dict]:
    class_room = _get_class_for_teacher_or_raise(db, teacher_user_id, class_id)
    total_student_count = _count_active_members(db, class_room.id)
    grouped_subquery = _build_character_records_grouped_subquery(
        class_id,
        character_name=character_name,
        date_from=date_from,
        date_to=date_to,
    )

    rows = db.execute(
        select(grouped_subquery).order_by(
            grouped_subquery.c.character_name.asc(),
            grouped_subquery.c.scenario_sort_order.asc().nullslast(),
        )
    ).all()

    return [
        {
            "id": _build_character_record_id(
                row.character_name,
                row.scenario_title,
                row.scenario_sort_order,
            ),
            "character_name": row.character_name,
            "scenario_title": row.scenario_title,
            "scenario_sort_order": row.scenario_sort_order,
            "average_history_score": float(row.average_history_score),
            "completed_student_count": int(row.completed_student_count),
            "total_student_count": total_student_count,
        }
        for row in rows
    ]


def list_character_record_students_for_teacher(
    db: Session,
    teacher_user_id: int,
    class_id: int,
    record_id: str,
    *,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> List[dict]:
    _get_class_for_teacher_or_raise(db, teacher_user_id, class_id)
    character_name, scenario_sort_order, scenario_title = _parse_character_record_id(record_id)

    conditions = [
        *_character_record_group_conditions(class_id, date_from=date_from, date_to=date_to),
        *_character_record_match_conditions(
            character_name,
            scenario_sort_order,
            scenario_title,
        ),
    ]

    rows = db.execute(
        select(PlaySession, User)
        .join(User, PlaySession.user_id == User.id)
        .join(ClassMembership, ClassMembership.user_id == User.id)
        .outerjoin(Scenario, PlaySession.scenario_id == Scenario.id)
        .where(*conditions)
        .order_by(
            User.name.asc().nullslast(),
            User.login_id.asc().nullslast(),
            PlaySession.completed_at.desc().nullslast(),
            PlaySession.created_at.desc(),
        )
    ).all()

    seen_user_ids: set[int] = set()
    items: List[dict] = []
    for session, user in rows:
        if user.id in seen_user_ids:
            continue
        seen_user_ids.add(user.id)
        items.append(
            {
                "user_id": user.id,
                "login_id": user.login_id,
                "name": user.name,
                "nickname": user.nickname,
                "history_score": session.history_score,
                "completed_at": session.completed_at,
            }
        )
    return items


def list_class_play_sessions_for_teacher(
    db: Session,
    teacher_user_id: int,
    class_id: int,
    *,
    name: Optional[str] = None,
    nickname: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    page: int = 1,
    page_size: int = 10,
) -> Tuple[List[dict], int]:
    _get_class_for_teacher_or_raise(db, teacher_user_id, class_id)
    base_query = _build_class_play_sessions_query(
        class_id,
        name=name,
        nickname=nickname,
        date_from=date_from,
        date_to=date_to,
    )

    total = db.scalar(select(func.count()).select_from(base_query.subquery())) or 0

    rows = db.execute(
        base_query
        .order_by(PlaySession.completed_at.desc().nullslast(), PlaySession.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    items = [_to_class_student_play_session(session, user) for session, user in rows]
    return items, total


def _build_class_play_sessions_query(
    class_id: int,
    *,
    name: Optional[str] = None,
    nickname: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
):
    conditions = [
        ClassMembership.class_id == class_id,
        ClassMembership.is_active.is_(True),
        User.deleted_at.is_(None),
        PlaySession.user_id == User.id,
        PlaySession.status == "completed",
    ]
    if name:
        conditions.append(User.name.ilike(f"%{name}%"))
    if nickname:
        conditions.append(User.nickname.ilike(f"%{nickname}%"))
    if date_from is not None:
        conditions.append(PlaySession.completed_at >= datetime.combine(date_from, time.min))
    if date_to is not None:
        conditions.append(PlaySession.completed_at <= datetime.combine(date_to, time.max))

    return (
        select(PlaySession, User)
        .join(User, PlaySession.user_id == User.id)
        .join(ClassMembership, ClassMembership.user_id == User.id)
        .options(selectinload(PlaySession.scenario))
        .where(*conditions)
    )


def list_class_play_sessions_for_teacher_export(
    db: Session,
    teacher_user_id: int,
    class_id: int,
    *,
    name: Optional[str] = None,
    nickname: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> List[dict]:
    _get_class_for_teacher_or_raise(db, teacher_user_id, class_id)

    rows = db.execute(
        _build_class_play_sessions_query(
            class_id,
            name=name,
            nickname=nickname,
            date_from=date_from,
            date_to=date_to,
        ).order_by(PlaySession.completed_at.desc().nullslast(), PlaySession.created_at.desc())
    ).all()

    return [_to_class_student_play_session(session, user) for session, user in rows]


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


def _to_admin_member_class_summary(
    class_room: ClassRoom,
    *,
    joined_at=None,
) -> dict:
    return {
        "class_id": class_room.id,
        "class_name": class_room.name,
        "entry_code": class_room.entry_code,
        "is_active": class_room.is_active,
        "joined_at": joined_at,
    }


def list_classes_for_user_admin(db: Session, user: User) -> List[dict]:
    if user.grade == UserGrade.TEACHER:
        classes = db.scalars(
            select(ClassRoom)
            .where(ClassRoom.teacher_user_id == user.id)
            .order_by(ClassRoom.created_at.desc())
        ).all()
        return [_to_admin_member_class_summary(class_room) for class_room in classes]

    if user.grade == UserGrade.STUDENT:
        memberships = db.scalars(
            select(ClassMembership)
            .where(
                ClassMembership.user_id == user.id,
                ClassMembership.is_active.is_(True),
            )
            .options(selectinload(ClassMembership.class_room))
            .order_by(ClassMembership.joined_at.desc())
        ).all()
        return [
            _to_admin_member_class_summary(membership.class_room, joined_at=membership.joined_at)
            for membership in memberships
            if membership.class_room is not None
        ]

    return []


def list_classes_for_student(
    db: Session,
    student_user_id: int,
    *,
    page: int = 1,
    page_size: int = 5,
) -> Tuple[List[dict], int]:
    query = (
        select(ClassMembership)
        .join(ClassRoom, ClassMembership.class_id == ClassRoom.id)
        .where(
            ClassMembership.user_id == student_user_id,
            ClassMembership.is_active.is_(True),
        )
        .options(selectinload(ClassMembership.class_room))
    )

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    memberships = db.scalars(
        query.order_by(ClassMembership.joined_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    return [
        _to_student_class_response(membership, membership.class_room)
        for membership in memberships
        if membership.class_room is not None
    ], total


def join_class_by_entry_code(db: Session, student: User, entry_code: str) -> dict:
    ensure_student_user(student)
    normalized_code = normalize_entry_code(entry_code)

    class_room = db.scalar(select(ClassRoom).where(ClassRoom.entry_code == normalized_code))
    if not class_room:
        raise ClassRoomEntryCodeNotFoundError()
    if not class_room.is_active:
        raise ClassRoomInactiveError()

    existing = db.scalar(
        select(ClassMembership).where(
            ClassMembership.class_id == class_room.id,
            ClassMembership.user_id == student.id,
        )
    )
    if existing:
        if existing.is_active:
            raise ClassRoomAlreadyMemberError()
        existing.is_active = True
        db.flush()
        db.refresh(existing)
        membership = existing
    else:
        membership = ClassMembership(
            class_id=class_room.id,
            user_id=student.id,
            is_active=True,
        )
        db.add(membership)
        db.flush()
        db.refresh(membership)

    return _to_student_class_response(membership, class_room)
