from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import User
from models.classroom.classroom import ClassJoinRequest, StudentClassResponse
from models.common.pagination import PaginatedResponse
from repositories.classroom import classroom as classroom_repository
from core.class_policy import InvalidEntryCodeError
from router.v2.deps import require_student

router = APIRouter(
    prefix="/api/v2/my/classes",
    tags=["My Classes v2"],
)


def _map_student_class_error(exc: Exception) -> HTTPException:
    if isinstance(exc, InvalidEntryCodeError):
        return HTTPException(status_code=400, detail=str(exc))
    if isinstance(exc, classroom_repository.ClassRoomEntryCodeNotFoundError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, classroom_repository.ClassRoomInactiveError):
        return HTTPException(status_code=400, detail=str(exc))
    if isinstance(exc, classroom_repository.ClassRoomAlreadyMemberError):
        return HTTPException(status_code=409, detail=str(exc))
    if isinstance(exc, classroom_repository.ClassRoomStudentRequiredError):
        return HTTPException(status_code=403, detail=str(exc))
    raise exc


@router.get("", response_model=PaginatedResponse[StudentClassResponse])
def list_my_classes(
    page: int = Query(1, ge=1, description="페이지 번호"),
    page_size: int = Query(5, ge=1, le=100, description="페이지당 항목 수"),
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    """학생 — 가입한 클래스 목록."""
    items, total = classroom_repository.list_classes_for_student(
        db,
        current_user.id,
        page=page,
        page_size=page_size,
    )
    return PaginatedResponse[StudentClassResponse](
        items=[StudentClassResponse.model_validate(item) for item in items],
        page=page,
        page_size=page_size,
        total=total,
        total_pages=(total + page_size - 1) // page_size if total > 0 else 0,
    )


@router.post("/join", response_model=StudentClassResponse, status_code=201)
def join_class(
    body: ClassJoinRequest,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    """학생 — 입장코드로 클래스 가입."""
    try:
        membership = classroom_repository.join_class_by_entry_code(
            db,
            current_user,
            body.entry_code,
        )
        db.commit()
    except (
        InvalidEntryCodeError,
        classroom_repository.ClassRoomEntryCodeNotFoundError,
        classroom_repository.ClassRoomInactiveError,
        classroom_repository.ClassRoomAlreadyMemberError,
        classroom_repository.ClassRoomStudentRequiredError,
    ) as exc:
        db.rollback()
        raise _map_student_class_error(exc) from exc

    return StudentClassResponse.model_validate(membership)
