from app.core.security import (
    generate_access_token,
    generate_room_code,
    hash_access_token,
)


def test_access_token_format_and_hash() -> None:
    token = generate_access_token()
    assert token.startswith("wt_")
    assert len(token) >= 45
    assert len(hash_access_token(token)) == 64


def test_room_code_format() -> None:
    code = generate_room_code()
    assert len(code) == 10
    assert set(code) <= set("abcdefghijkmnpqrstuvwxyz23456789")
