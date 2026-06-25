from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from core.excel import build_workbook_bytes
from db.database import get_db
from db.models import User
from models.classroom.classroom import (
    ClassActivitySummaryResponse,
    ClassCharacterRecordStudentListResponse,
    ClassCharacterRecordSummaryResponse,
    ClassPlaySessionListItemResponse,
    ClassRoomCreateRequest,
    ClassRoomDetailResponse,
    ClassRoomResponse,
    ClassRoomUpdateRequest,
    ClassStudentSessionSummaryResponse,
)
from models.common.pagination import ALLOWED_PAGE_SIZES, PaginatedResponse
from repositories.classroom import classroom as classroom_repository
from core.class_policy import InvalidClassNameError, InvalidEntryCodeError
from router.v2.deps import require_teacher

router = APIRouter(
    prefix="/api/v2/classes",
    tags=["Classes v2"],
    dependencies=[Depends(require_teacher)],
)

EXCEL_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _map_class_error(exc: Exception) -> HTTPException:
    if isinstance(exc, classroom_repository.ClassRoomNotFoundError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, classroom_repository.ClassRoomTeacherRequiredError):
        return HTTPException(status_code=403, detail=str(exc))
    if isinstance(exc, InvalidClassNameError):
        return HTTPException(status_code=400, detail=str(exc))
    if isinstance(exc, InvalidEntryCodeError):
        return HTTPException(status_code=400, detail=str(exc))
    if isinstance(exc, classroom_repository.ClassRoomDuplicateEntryCodeError):
        return HTTPException(status_code=409, detail=str(exc))
    raise exc


def _build_excel_response(filename: str, content: bytes) -> Response:
    return Response(
        content=content,
        media_type=EXCEL_MEDIA_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("", response_model=PaginatedResponse[ClassRoomResponse])
def list_my_classes(
    name: Optional[str] = Query(None, description="클래스 이름 부분 일치"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    page_size: int = Query(20, ge=1, le=100, description="페이지당 항목 수"),
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """지도자 — 내 클래스 목록."""
    if page_size not in ALLOWED_PAGE_SIZES:
        raise HTTPException(
            status_code=422,
            detail="페이지당 항목 수는 10, 20, 50, 100 중 하나여야 합니다.",
        )

    items, total = classroom_repository.list_classes_for_teacher(
        db,
        current_user.id,
        name=name,
        page=page,
        page_size=page_size,
    )
    return PaginatedResponse[ClassRoomResponse](
        items=[ClassRoomResponse.model_validate(item) for item in items],
        page=page,
        page_size=page_size,
        total=total,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.post("", response_model=ClassRoomResponse, status_code=201)
def create_class(
    body: ClassRoomCreateRequest,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """지도자 — 클래스 생성 (입장코드 직접 입력, 연도 접두사 자동)."""
    try:
        class_room = classroom_repository.create_class(
            db,
            current_user,
            body.name,
            body.entry_code_suffix,
        )
        db.commit()
    except (
        InvalidClassNameError,
        InvalidEntryCodeError,
        classroom_repository.ClassRoomDuplicateEntryCodeError,
        classroom_repository.ClassRoomTeacherRequiredError,
    ) as exc:
        db.rollback()
        raise _map_class_error(exc) from exc

    return ClassRoomResponse.model_validate(class_room)


@router.get("/{class_id}/activity-summary", response_model=ClassActivitySummaryResponse)
def get_class_activity_summary(
    class_id: int,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
    date_from: date | None = Query(None, description="완료일 시작일(YYYY-MM-DD)"),
    date_to: date | None = Query(None, description="완료일 종료일(YYYY-MM-DD)"),
):
    """지도자 — 클래스 활동 요약."""
    try:
        summary = classroom_repository.get_class_activity_summary_for_teacher(
            db,
            current_user.id,
            class_id,
            date_from=date_from,
            date_to=date_to,
        )
    except classroom_repository.ClassRoomNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return ClassActivitySummaryResponse.model_validate(summary)


@router.get(
    "/{class_id}/student-sessions",
    response_model=PaginatedResponse[ClassStudentSessionSummaryResponse],
)
def list_class_student_sessions(
    class_id: int,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
    name: Optional[str] = Query(None, description="학생 이름 부분 일치"),
    nickname: Optional[str] = Query(None, description="닉네임 부분 일치"),
    date_from: date | None = Query(None, description="완료일 시작일(YYYY-MM-DD)"),
    date_to: date | None = Query(None, description="완료일 종료일(YYYY-MM-DD)"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    page_size: int = Query(10, ge=1, le=100, description="페이지당 항목 수"),
):
    """지도자 — 클래스 학생별 플레이 기록."""
    if page_size not in ALLOWED_PAGE_SIZES:
        raise HTTPException(
            status_code=422,
            detail="페이지당 항목 수는 10, 20, 50, 100 중 하나여야 합니다.",
        )

    try:
        items, total = classroom_repository.list_student_sessions_for_teacher(
            db,
            current_user.id,
            class_id,
            name=name,
            nickname=nickname,
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size,
        )
    except classroom_repository.ClassRoomNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return PaginatedResponse[ClassStudentSessionSummaryResponse](
        items=[ClassStudentSessionSummaryResponse.model_validate(item) for item in items],
        page=page,
        page_size=page_size,
        total=total,
        total_pages=(total + page_size - 1) // page_size if total > 0 else 0,
    )


@router.get(
    "/{class_id}/character-records",
    response_model=PaginatedResponse[ClassCharacterRecordSummaryResponse],
)
def list_class_character_records(
    class_id: int,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
    character_name: Optional[str] = Query(None, description="인물명 부분 일치"),
    date_from: date | None = Query(None, description="완료일 시작일(YYYY-MM-DD)"),
    date_to: date | None = Query(None, description="완료일 종료일(YYYY-MM-DD)"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    page_size: int = Query(10, ge=1, le=100, description="페이지당 항목 수"),
):
    """지도자 — 클래스 인물·시나리오별 집계 기록."""
    if page_size not in ALLOWED_PAGE_SIZES:
        raise HTTPException(
            status_code=422,
            detail="페이지당 항목 수는 10, 20, 50, 100 중 하나여야 합니다.",
        )

    try:
        items, total = classroom_repository.list_character_records_for_teacher(
            db,
            current_user.id,
            class_id,
            character_name=character_name,
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size,
        )
    except classroom_repository.ClassRoomNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return PaginatedResponse[ClassCharacterRecordSummaryResponse](
        items=[ClassCharacterRecordSummaryResponse.model_validate(item) for item in items],
        page=page,
        page_size=page_size,
        total=total,
        total_pages=(total + page_size - 1) // page_size if total > 0 else 0,
    )


@router.get(
    "/{class_id}/character-records/{record_id}/students",
    response_model=ClassCharacterRecordStudentListResponse,
)
def list_class_character_record_students(
    class_id: int,
    record_id: str,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
    date_from: date | None = Query(None, description="완료일 시작일(YYYY-MM-DD)"),
    date_to: date | None = Query(None, description="완료일 종료일(YYYY-MM-DD)"),
):
    """지도자 — 인물·시나리오별 완료 학생 목록."""
    try:
        items = classroom_repository.list_character_record_students_for_teacher(
            db,
            current_user.id,
            class_id,
            record_id,
            date_from=date_from,
            date_to=date_to,
        )
    except classroom_repository.ClassRoomNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except classroom_repository.ClassCharacterRecordInvalidIdError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return ClassCharacterRecordStudentListResponse.model_validate({"items": items})


@router.get(
    "/{class_id}/play-sessions",
    response_model=PaginatedResponse[ClassPlaySessionListItemResponse],
)
def list_class_play_sessions(
    class_id: int,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
    name: Optional[str] = Query(None, description="학생 이름 부분 일치"),
    nickname: Optional[str] = Query(None, description="닉네임 부분 일치"),
    date_from: date | None = Query(None, description="완료일 시작일(YYYY-MM-DD)"),
    date_to: date | None = Query(None, description="완료일 종료일(YYYY-MM-DD)"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    page_size: int = Query(10, ge=1, le=100, description="페이지당 항목 수"),
):
    """지도자 — 클래스 전체 플레이 기록."""
    if page_size not in ALLOWED_PAGE_SIZES:
        raise HTTPException(
            status_code=422,
            detail="페이지당 항목 수는 10, 20, 50, 100 중 하나여야 합니다.",
        )

    try:
        items, total = classroom_repository.list_class_play_sessions_for_teacher(
            db,
            current_user.id,
            class_id,
            name=name,
            nickname=nickname,
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size,
        )
    except classroom_repository.ClassRoomNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return PaginatedResponse[ClassPlaySessionListItemResponse](
        items=[ClassPlaySessionListItemResponse.model_validate(item) for item in items],
        page=page,
        page_size=page_size,
        total=total,
        total_pages=(total + page_size - 1) // page_size if total > 0 else 0,
    )


@router.get("/{class_id}/students/export")
def export_class_students(
    class_id: int,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
    name: Optional[str] = Query(None, description="학생 이름 부분 일치"),
    nickname: Optional[str] = Query(None, description="닉네임 부분 일치"),
):
    try:
        items = classroom_repository.list_class_members_for_teacher(
            db,
            current_user.id,
            class_id,
            name=name,
            nickname=nickname,
        )
    except classroom_repository.ClassRoomNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    content = build_workbook_bytes(
        [
            (
                "학생 목록",
                ["아이디", "이름", "닉네임", "참여일"],
                [
                    [
                        item["login_id"] or "",
                        item["name"] or "",
                        item["nickname"] or "",
                        item["joined_at"],
                    ]
                    for item in items
                ],
            )
        ]
    )
    return _build_excel_response(
        f"class-{class_id}-students-{date.today().isoformat()}.xlsx",
        content,
    )


@router.get("/{class_id}/student-sessions/export")
def export_class_student_sessions(
    class_id: int,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
    name: Optional[str] = Query(None, description="학생 이름 부분 일치"),
    nickname: Optional[str] = Query(None, description="닉네임 부분 일치"),
    date_from: date | None = Query(None, description="완료일 시작일(YYYY-MM-DD)"),
    date_to: date | None = Query(None, description="완료일 종료일(YYYY-MM-DD)"),
):
    try:
        items = classroom_repository.list_student_sessions_for_teacher_export(
            db,
            current_user.id,
            class_id,
            name=name,
            nickname=nickname,
            date_from=date_from,
            date_to=date_to,
        )
    except classroom_repository.ClassRoomNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    detail_rows = []
    for item in items:
        for session in item["sessions"]:
            detail_rows.append(
                [
                    item["login_id"] or "",
                    item["name"] or "",
                    item["nickname"] or "",
                    session["character_name"],
                    session["scenario_title"],
                    session["history_score"],
                    session["completed_at"],
                ]
            )

    content = build_workbook_bytes(
        [
            (
                "학생별 요약",
                ["아이디", "이름", "닉네임", "참여일", "완료 건수", "평균 역사 점수", "최근 완료일"],
                [
                    [
                        item["login_id"] or "",
                        item["name"] or "",
                        item["nickname"] or "",
                        item["joined_at"],
                        item["completed_count"],
                        item["average_history_score"],
                        item["latest_completed_at"],
                    ]
                    for item in items
                ],
            ),
            (
                "세션 상세",
                ["학생 아이디", "학생 이름", "학생 닉네임", "인물", "시나리오", "역사 점수", "완료일"],
                detail_rows,
            ),
        ]
    )
    return _build_excel_response(
        f"class-{class_id}-student-sessions-{date.today().isoformat()}.xlsx",
        content,
    )


@router.get("/{class_id}/character-records/export")
def export_class_character_records(
    class_id: int,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
    character_name: Optional[str] = Query(None, description="인물명 부분 일치"),
    date_from: date | None = Query(None, description="완료일 시작일(YYYY-MM-DD)"),
    date_to: date | None = Query(None, description="완료일 종료일(YYYY-MM-DD)"),
):
    try:
        items = classroom_repository.list_character_records_for_teacher_export(
            db,
            current_user.id,
            class_id,
            character_name=character_name,
            date_from=date_from,
            date_to=date_to,
        )
    except classroom_repository.ClassRoomNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    student_rows = []
    for item in items:
        students = classroom_repository.list_character_record_students_for_teacher(
            db,
            current_user.id,
            class_id,
            item["id"],
            date_from=date_from,
            date_to=date_to,
        )
        for student in students:
            student_rows.append(
                [
                    item["character_name"],
                    item["scenario_title"],
                    student["login_id"] or "",
                    student["name"] or "",
                    student["nickname"] or "",
                    student["history_score"],
                    student["completed_at"],
                ]
            )

    content = build_workbook_bytes(
        [
            (
                "인물 기록",
                ["인물", "시나리오", "평균 역사 점수", "완료 학생 수", "전체 학생 수"],
                [
                    [
                        item["character_name"],
                        item["scenario_title"],
                        item["average_history_score"],
                        item["completed_student_count"],
                        item["total_student_count"],
                    ]
                    for item in items
                ],
            ),
            (
                "완료 학생 상세",
                ["인물", "시나리오", "학생 아이디", "학생 이름", "학생 닉네임", "역사 점수", "완료일"],
                student_rows,
            ),
        ]
    )
    return _build_excel_response(
        f"class-{class_id}-character-records-{date.today().isoformat()}.xlsx",
        content,
    )


@router.get("/{class_id}/play-sessions/export")
def export_class_play_sessions(
    class_id: int,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
    name: Optional[str] = Query(None, description="학생 이름 부분 일치"),
    nickname: Optional[str] = Query(None, description="닉네임 부분 일치"),
    date_from: date | None = Query(None, description="완료일 시작일(YYYY-MM-DD)"),
    date_to: date | None = Query(None, description="완료일 종료일(YYYY-MM-DD)"),
):
    try:
        items = classroom_repository.list_class_play_sessions_for_teacher_export(
            db,
            current_user.id,
            class_id,
            name=name,
            nickname=nickname,
            date_from=date_from,
            date_to=date_to,
        )
    except classroom_repository.ClassRoomNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    content = build_workbook_bytes(
        [
            (
                "전체 기록",
                ["학생 아이디", "학생 이름", "학생 닉네임", "인물", "시나리오", "역사 점수", "완료일"],
                [
                    [
                        item["student_login_id"] or "",
                        item["student_name"] or "",
                        item["student_nickname"] or "",
                        item["character_name"],
                        item["scenario_title"],
                        item["history_score"],
                        item["completed_at"],
                    ]
                    for item in items
                ],
            )
        ]
    )
    return _build_excel_response(
        f"class-{class_id}-play-sessions-{date.today().isoformat()}.xlsx",
        content,
    )


@router.get("/{class_id}", response_model=ClassRoomDetailResponse)
def get_class(
    class_id: int,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """지도자 — 클래스 상세 (소속 학생 목록 포함)."""
    try:
        class_room = classroom_repository.get_class_detail_for_teacher(db, current_user.id, class_id)
    except classroom_repository.ClassRoomNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return ClassRoomDetailResponse.model_validate(class_room)


@router.patch("/{class_id}", response_model=ClassRoomResponse)
def update_class(
    class_id: int,
    body: ClassRoomUpdateRequest,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """지도자 — 클래스 수정."""
    updates = body.model_dump(exclude_unset=True)
    try:
        class_room = classroom_repository.update_class(
            db,
            current_user,
            class_id,
            name=updates.get("name"),
            is_active=updates.get("is_active"),
        )
        db.commit()
    except (
        InvalidClassNameError,
        classroom_repository.ClassRoomNotFoundError,
        classroom_repository.ClassRoomTeacherRequiredError,
    ) as exc:
        db.rollback()
        raise _map_class_error(exc) from exc

    return ClassRoomResponse.model_validate(class_room)


@router.delete("/{class_id}", response_model=ClassRoomResponse)
def delete_class(
    class_id: int,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """지도자 — 클래스 삭제."""
    try:
        class_room = classroom_repository.delete_class(db, current_user, class_id)
        db.commit()
    except (
        classroom_repository.ClassRoomNotFoundError,
        classroom_repository.ClassRoomTeacherRequiredError,
    ) as exc:
        db.rollback()
        raise _map_class_error(exc) from exc

    return ClassRoomResponse.model_validate(class_room)
