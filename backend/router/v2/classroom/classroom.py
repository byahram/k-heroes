from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import User
from models.classroom.classroom import (
    ClassRoomCreateRequest,
    ClassRoomDetailResponse,
    ClassRoomResponse,
    ClassRoomUpdateRequest,
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
