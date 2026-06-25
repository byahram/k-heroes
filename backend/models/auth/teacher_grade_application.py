from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from db.models import TeacherGradeApplicationStatus, UserGrade


class TeacherGradeApplicationCreateRequest(BaseModel):
    school_name: str = Field(..., max_length=200, description="소속 학교/기관")

    model_config = ConfigDict(extra="forbid")


class TeacherGradeApplicationResponse(BaseModel):
    id: int
    user_id: int
    user_login_id: Optional[str] = None
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_grade: UserGrade
    school_name: Optional[str] = None
    status: TeacherGradeApplicationStatus
    review_note: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TeacherGradeApplicationReviewRequest(BaseModel):
    review_note: Optional[str] = Field(None, max_length=1000, description="검토 메모")

    model_config = ConfigDict(extra="forbid")
