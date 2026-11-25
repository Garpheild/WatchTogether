import pytest

from app.chat.service import validate_message_text
from app.core.errors import ValidationError


def test_message_is_trimmed() -> None:
    assert validate_message_text("  hello  ") == "hello"


def test_newlines_are_allowed() -> None:
    assert validate_message_text("one\ntwo") == "one\ntwo"


@pytest.mark.parametrize("value", ["", "   ", "a" * 501])
def test_invalid_length_is_rejected(value: str) -> None:
    with pytest.raises(ValidationError):
        validate_message_text(value)


def test_control_characters_are_rejected() -> None:
    with pytest.raises(ValidationError):
        validate_message_text("bad\ttext")
