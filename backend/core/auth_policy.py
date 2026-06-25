import hashlib
import re


LOGIN_ID_MIN_LENGTH = 4
LOGIN_ID_MAX_LENGTH = 50
GOOGLE_LOGIN_ID_PREFIX = "g@"
EMAIL_MAX_LENGTH = 255
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def _is_lowercase_english_letter(character: str) -> bool:
    return "a" <= character <= "z"


def _is_allowed_login_id_character(character: str) -> bool:
    return (
        _is_lowercase_english_letter(character)
        or "0" <= character <= "9"
        or ("!" <= character <= "~" and not character.isalnum())
    )


class InvalidLoginIdError(ValueError):
    pass


class InvalidEmailError(ValueError):
    pass


def normalize_login_id(login_id: str) -> str:
    return login_id.strip()


def normalize_email(email: str) -> str:
    return email.strip()


def build_google_login_id(provider_user_id: str) -> str:
    sub = provider_user_id.strip()
    if not sub:
        raise InvalidLoginIdError("구글 계정 식별값이 없습니다.")

    candidate = f"{GOOGLE_LOGIN_ID_PREFIX}{sub}"
    if len(candidate) > LOGIN_ID_MAX_LENGTH:
        digest = hashlib.sha256(sub.encode()).hexdigest()
        max_sub_len = LOGIN_ID_MAX_LENGTH - len(GOOGLE_LOGIN_ID_PREFIX)
        candidate = f"{GOOGLE_LOGIN_ID_PREFIX}{digest[:max_sub_len]}"

    return validate_login_id(candidate)


def validate_login_id(login_id: str) -> str:
    normalized = normalize_login_id(login_id)

    if not normalized:
        raise InvalidLoginIdError("아이디를 입력해 주세요.")

    if not _is_lowercase_english_letter(normalized[0]):
        raise InvalidLoginIdError("아이디는 소문자로 시작해 주세요.")

    if not all(_is_allowed_login_id_character(character) for character in normalized):
        raise InvalidLoginIdError("아이디는 소문자/숫자/특수문자만 입력해 주세요.")

    if len(normalized) < LOGIN_ID_MIN_LENGTH or len(normalized) > LOGIN_ID_MAX_LENGTH:
        raise InvalidLoginIdError("아이디는 4자 이상 50자 이하로 입력해 주세요.")

    return normalized


def validate_optional_email(email: str | None) -> str | None:
    if email is None:
        return None

    normalized = normalize_email(email)
    if not normalized:
        return None

    if len(normalized) > EMAIL_MAX_LENGTH:
        raise InvalidEmailError("이메일은 255자 이하로 입력해 주세요.")

    if not EMAIL_PATTERN.fullmatch(normalized):
        raise InvalidEmailError("이메일 형식이 올바르지 않습니다.")

    return normalized
