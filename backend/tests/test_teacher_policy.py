import pytest

from core.teacher_policy import (
    TeacherProfileIncompleteError,
    validate_school_name,
    validate_teacher_contact_profile,
)
from db.models import AuthProvider, User, UserGrade


def test_validate_teacher_contact_profile_requires_name_and_email():
    with pytest.raises(TeacherProfileIncompleteError):
        validate_teacher_contact_profile(None, "teacher@example.com")

    with pytest.raises(TeacherProfileIncompleteError):
        validate_teacher_contact_profile("선생님", None)

    name, email = validate_teacher_contact_profile("선생님", "teacher@example.com")
    assert name == "선생님"
    assert email == "teacher@example.com"


def test_validate_school_name_requires_non_empty_value():
    with pytest.raises(TeacherProfileIncompleteError):
        validate_school_name(None)

    with pytest.raises(TeacherProfileIncompleteError):
        validate_school_name("   ")

    assert validate_school_name("  OO초등학교  ") == "OO초등학교"
