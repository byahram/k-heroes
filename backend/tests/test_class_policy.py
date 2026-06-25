import pytest

from core.class_policy import (
    build_entry_code,
    current_year_prefix,
    normalize_class_name,
    normalize_entry_code_suffix,
    InvalidClassNameError,
    InvalidEntryCodeError,
)


def test_normalize_class_name_requires_non_empty_value():
    with pytest.raises(InvalidClassNameError):
        normalize_class_name("   ")

    assert normalize_class_name("  4학년 1반  ") == "4학년 1반"


def test_build_entry_code_prefixes_current_year():
    assert build_entry_code("4a1") == f"{current_year_prefix()}4a1"
    assert build_entry_code("00초4학년1반") == f"{current_year_prefix()}00초4학년1반"


def test_normalize_entry_code_suffix_rejects_too_short_value():
    with pytest.raises(InvalidEntryCodeError):
        normalize_entry_code_suffix("a")


def test_normalize_entry_code_suffix_rejects_whitespace():
    with pytest.raises(InvalidEntryCodeError):
        normalize_entry_code_suffix("4학년 1반")
