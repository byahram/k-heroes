from core.auth_policy import InvalidEmailError, validate_optional_email


SCHOOL_NAME_MAX_LENGTH = 200


class TeacherProfileIncompleteError(ValueError):
    def __init__(self, field_name: str):
        self.field_name = field_name
        if field_name == "name":
            super().__init__("지도자 신청을 위해 이름을 등록해 주세요.")
        elif field_name == "email":
            super().__init__("지도자 신청을 위해 이메일을 등록해 주세요.")
        elif field_name == "school_name":
            super().__init__("지도자 신청을 위해 소속(학교/기관)을 입력해 주세요.")
        else:
            super().__init__("지도자 신청에 필요한 정보가 부족합니다.")


def validate_teacher_contact_profile(name: str | None, email: str | None) -> tuple[str, str]:
    normalized_name = (name or "").strip()
    if not normalized_name:
        raise TeacherProfileIncompleteError("name")

    try:
        normalized_email = validate_optional_email(email)
    except InvalidEmailError as exc:
        raise TeacherProfileIncompleteError("email") from exc

    if not normalized_email:
        raise TeacherProfileIncompleteError("email")

    return normalized_name, normalized_email


def validate_school_name(school_name: str | None) -> str:
    normalized = (school_name or "").strip()
    if not normalized:
        raise TeacherProfileIncompleteError("school_name")
    if len(normalized) > SCHOOL_NAME_MAX_LENGTH:
        raise TeacherProfileIncompleteError("school_name")
    return normalized
