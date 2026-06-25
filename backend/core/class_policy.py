from datetime import datetime, timezone

ENTRY_CODE_SUFFIX_MIN_LENGTH = 2
ENTRY_CODE_SUFFIX_MAX_LENGTH = 12
ENTRY_CODE_MIN_LENGTH = 6
ENTRY_CODE_MAX_LENGTH = 16
CLASS_NAME_MAX_LENGTH = 100


class InvalidClassNameError(ValueError):
    def __init__(self):
        super().__init__("클래스 이름을 입력해 주세요.")


class InvalidEntryCodeError(ValueError):
    def __init__(self, message: str):
        super().__init__(message)


def current_year_prefix() -> str:
    return str(datetime.now(timezone.utc).year)


def normalize_class_name(name: str | None) -> str:
    normalized = (name or "").strip()
    if not normalized:
        raise InvalidClassNameError()
    if len(normalized) > CLASS_NAME_MAX_LENGTH:
        raise InvalidClassNameError()
    return normalized


def normalize_entry_code_suffix(entry_code_suffix: str | None) -> str:
    normalized = (entry_code_suffix or "").strip()
    if not normalized:
        raise InvalidEntryCodeError("입장코드 식별 문자를 입력해 주세요.")
    if any(char.isspace() for char in normalized):
        raise InvalidEntryCodeError("입장코드에는 공백을 사용할 수 없습니다.")
    if len(normalized) < ENTRY_CODE_SUFFIX_MIN_LENGTH:
        raise InvalidEntryCodeError(
            f"입장코드 식별 문자는 {ENTRY_CODE_SUFFIX_MIN_LENGTH}자 이상 입력해 주세요."
        )
    if len(normalized) > ENTRY_CODE_SUFFIX_MAX_LENGTH:
        raise InvalidEntryCodeError(
            f"입장코드 식별 문자는 {ENTRY_CODE_SUFFIX_MAX_LENGTH}자 이내로 입력해 주세요."
        )
    return normalized


def normalize_entry_code(entry_code: str | None) -> str:
    normalized = (entry_code or "").strip()
    if not normalized:
        raise InvalidEntryCodeError("입장코드를 입력해 주세요.")
    if any(char.isspace() for char in normalized):
        raise InvalidEntryCodeError("입장코드에는 공백을 사용할 수 없습니다.")
    if len(normalized) < ENTRY_CODE_MIN_LENGTH:
        raise InvalidEntryCodeError(
            f"입장코드는 {ENTRY_CODE_MIN_LENGTH}자 이상 입력해 주세요."
        )
    if len(normalized) > ENTRY_CODE_MAX_LENGTH:
        raise InvalidEntryCodeError("입장코드가 너무 깁니다.")
    if not normalized[:4].isdigit():
        raise InvalidEntryCodeError("입장코드는 연도 4자리로 시작해야 합니다.")
    return normalized


def build_entry_code(entry_code_suffix: str | None) -> str:
    suffix = normalize_entry_code_suffix(entry_code_suffix)
    entry_code = f"{current_year_prefix()}{suffix}"
    if len(entry_code) > ENTRY_CODE_MAX_LENGTH:
        raise InvalidEntryCodeError("입장코드가 너무 깁니다.")
    return entry_code
