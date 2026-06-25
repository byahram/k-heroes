from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ClassRoomCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="클래스 이름")
    entry_code_suffix: str = Field(
        ...,
        min_length=1,
        max_length=12,
        description="입장코드 식별 문자 (연도 접두사 제외, 2~12자)",
    )

    model_config = ConfigDict(extra="forbid")


class ClassRoomUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="클래스 이름")
    is_active: Optional[bool] = Field(None, description="활성 여부 (false면 입장코드 비활성)")

    model_config = ConfigDict(extra="forbid")


class ClassRoomResponse(BaseModel):
    id: int
    teacher_user_id: int
    name: str
    entry_code: str
    is_active: bool
    member_count: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClassMemberResponse(BaseModel):
    membership_id: int
    user_id: int
    login_id: Optional[str] = None
    name: Optional[str] = None
    nickname: Optional[str] = None
    joined_at: datetime
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class ClassRoomDetailResponse(ClassRoomResponse):
    members: list[ClassMemberResponse]


class ClassActivitySummaryResponse(BaseModel):
    total_students: int
    participating_students: int
    completed_sessions: int
    average_history_score: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class ClassStudentPlaySessionResponse(BaseModel):
    id: str
    student_login_id: Optional[str] = None
    student_name: Optional[str] = None
    student_nickname: Optional[str] = None
    character_name: str
    scenario_title: str
    scenario_sort_order: Optional[int] = None
    history_score: int
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ClassStudentSessionSummaryResponse(BaseModel):
    membership_id: int
    user_id: int
    login_id: Optional[str] = None
    name: Optional[str] = None
    nickname: Optional[str] = None
    joined_at: datetime
    completed_count: int
    average_history_score: Optional[float] = None
    latest_completed_at: Optional[datetime] = None
    sessions: list[ClassStudentPlaySessionResponse]

    model_config = ConfigDict(from_attributes=True)


class ClassPlaySessionListItemResponse(BaseModel):
    id: str
    student_login_id: Optional[str] = None
    student_name: Optional[str] = None
    student_nickname: Optional[str] = None
    character_name: str
    scenario_title: str
    scenario_sort_order: Optional[int] = None
    history_score: int
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ClassCharacterRecordSummaryResponse(BaseModel):
    id: str
    character_name: str
    scenario_title: str
    scenario_sort_order: Optional[int] = None
    average_history_score: float
    completed_student_count: int
    total_student_count: int

    model_config = ConfigDict(from_attributes=True)


class ClassCharacterRecordStudentResponse(BaseModel):
    user_id: int
    login_id: Optional[str] = None
    name: Optional[str] = None
    nickname: Optional[str] = None
    history_score: int
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ClassCharacterRecordStudentListResponse(BaseModel):
    items: list[ClassCharacterRecordStudentResponse]

    model_config = ConfigDict(from_attributes=True)


class AdminClassRoomResponse(BaseModel):
    id: int
    teacher_user_id: int
    teacher_login_id: Optional[str] = None
    teacher_name: Optional[str] = None
    teacher_email: Optional[str] = None
    name: str
    entry_code: str
    is_active: bool
    member_count: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminClassRoomDetailResponse(AdminClassRoomResponse):
    members: list[ClassMemberResponse]


class ClassJoinRequest(BaseModel):
    entry_code: str = Field(..., min_length=1, max_length=16, description="클래스 입장코드 전체")

    model_config = ConfigDict(extra="forbid")


class StudentClassResponse(BaseModel):
    membership_id: int
    class_id: int
    class_name: str
    entry_code: str
    joined_at: datetime
    is_class_active: bool

    model_config = ConfigDict(from_attributes=True)
