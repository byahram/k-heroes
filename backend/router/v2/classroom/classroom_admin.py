from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import AdminRole
from models.classroom.classroom import AdminClassRoomDetailResponse, AdminClassRoomResponse
from models.common.pagination import ALLOWED_PAGE_SIZES, PaginatedResponse
from repositories.classroom import classroom as classroom_repository
from router.v2.deps import require_roles

admin_router = APIRouter(
    prefix="/api/v2/admin/classes",
    tags=["Classes v2 Admin"],
    dependencies=[Depends(require_roles(AdminRole.SUPERADMIN, AdminRole.ADMIN))],
)


@admin_router.get("", response_model=PaginatedResponse[AdminClassRoomResponse])
def list_classes(
    is_active: Optional[bool] = Query(None, description="true=활성만, false=비활성만, 생략=전체"),
    teacher_login_id: Optional[str] = Query(None, description="지도자 아이디 부분 일치"),
    name: Optional[str] = Query(None, description="클래스 이름 부분 일치"),
    entry_code: Optional[str] = Query(None, description="입장코드 부분 일치"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    page_size: int = Query(20, ge=1, le=100, description="페이지당 항목 수"),
    db: Session = Depends(get_db),
):
    """어드민 — 클래스 목록."""
    if page_size not in ALLOWED_PAGE_SIZES:
        raise HTTPException(
            status_code=422,
            detail="페이지당 항목 수는 10, 20, 50, 100 중 하나여야 합니다.",
        )

    items, total = classroom_repository.list_classes_for_admin(
        db,
        is_active=is_active,
        teacher_login_id=teacher_login_id,
        name=name,
        entry_code=entry_code,
        page=page,
        page_size=page_size,
    )
    return PaginatedResponse[AdminClassRoomResponse](
        items=[AdminClassRoomResponse.model_validate(item) for item in items],
        page=page,
        page_size=page_size,
        total=total,
        total_pages=(total + page_size - 1) // page_size,
    )


@admin_router.get("/{class_id}", response_model=AdminClassRoomDetailResponse)
def get_class(class_id: int, db: Session = Depends(get_db)):
    """어드민 — 클래스 상세 (소속 학생 목록 포함)."""
    try:
        class_room = classroom_repository.get_class_detail_for_admin(db, class_id)
    except classroom_repository.ClassRoomNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return AdminClassRoomDetailResponse.model_validate(class_room)
