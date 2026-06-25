from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from db.models import AuthProvider, UserGrade


class AdminMemberResponse(BaseModel):
    id: int
    auth_provider: AuthProvider
    login_id: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    nickname: Optional[str] = None
    grade: UserGrade
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AdminMemberClassSummary(BaseModel):
    class_id: int
    class_name: str
    entry_code: str
    is_active: bool
    joined_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AdminMemberPlaySessionSummary(BaseModel):
    completed_count: int
    average_history_score: Optional[float] = None


class AdminMemberDetailResponse(AdminMemberResponse):
    classes: list[AdminMemberClassSummary] = []
    play_session_summary: AdminMemberPlaySessionSummary


class AdminMemberUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100, description="이름")
    nickname: Optional[str] = Field(None, max_length=100, description="닉네임")
    email: Optional[str] = Field(None, max_length=255, description="이메일")
    grade: Optional[UserGrade] = Field(None, description="student | teacher")
    password: Optional[str] = Field(None, min_length=8, max_length=128, description="비밀번호 (로컬 계정만)")

    model_config = ConfigDict(extra="forbid")


class UserResponse(BaseModel):
    id: int
    auth_provider: AuthProvider
    provider_user_id: Optional[str] = None
    login_id: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    nickname: Optional[str] = None
    grade: UserGrade
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserSignupRequest(BaseModel):
    login_id: str = Field(..., min_length=1, max_length=50, description="소문자로 시작하는 로그인 아이디")
    password: str = Field(..., min_length=8, max_length=128, description="비밀번호")
    name: Optional[str] = Field(None, max_length=100, description="이름")
    email: Optional[str] = Field(None, max_length=255, description="이메일")
    nickname: Optional[str] = Field(None, max_length=100, description="닉네임")

    model_config = ConfigDict(extra="forbid")


class UserLoginRequest(BaseModel):
    login_id: str = Field(..., min_length=1, max_length=50, description="소문자로 시작하는 로그인 아이디")
    password: str = Field(..., min_length=1, max_length=128)
    remember_me: bool = Field(False, description="브라우저 종료 후에도 로그인 유지")

    model_config = ConfigDict(extra="forbid")


class GoogleLoginRequest(BaseModel):
    id_token: str = Field(..., min_length=1, description="구글 ID 토큰")

    model_config = ConfigDict(extra="forbid")


class UserAuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class UserSessionResponse(BaseModel):
    user: UserResponse


class UserPlaySessionItem(BaseModel):
    id: str
    scenario_id: Optional[int] = None
    ending_id: Optional[int] = None
    character_name: str
    scenario_title: str
    scenario_sort_order: Optional[int] = None
    status: str
    history_score: int
    choices_path: list[str]
    choices_history: list[bool] = []
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class UserPlaySessionSummary(BaseModel):
    completed_count: int
    average_history_score: Optional[float] = None


class UserPlaySessionListResponse(BaseModel):
    items: list[UserPlaySessionItem]
    page: int
    page_size: int
    total: int
    total_pages: int
    summary: UserPlaySessionSummary


class UserUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, max_length=100, description="이름")
    email: Optional[str] = Field(None, max_length=255, description="이메일")
    nickname: Optional[str] = Field(None, max_length=100, description="닉네임")
    current_password: Optional[str] = Field(None, min_length=1, max_length=128, description="현재 비밀번호")
    new_password: Optional[str] = Field(None, min_length=8, max_length=128, description="새 비밀번호")

    model_config = ConfigDict(extra="forbid")


class AdminPlaySessionItem(BaseModel):
    id: str
    user_id: Optional[int] = None
    user_login_id: Optional[str] = None
    user_name: Optional[str] = None
    user_grade: Optional[UserGrade] = None
    scenario_id: Optional[int] = None
    ending_id: Optional[int] = None
    scenario_title: str
    scenario_sort_order: Optional[int] = None
    character_name: str
    status: str
    history_score: int
    choices_path: list[str]
    choices_history: list[bool] = []
    created_at: datetime
    completed_at: Optional[datetime] = None
    completed_date: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
