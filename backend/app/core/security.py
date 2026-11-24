import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import jwt

from app.core.config import get_settings

ROOM_CODE_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"


def generate_access_token() -> str:
    return "wt_" + secrets.token_urlsafe(32)


def hash_access_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_room_code(length: int = 10) -> str:
    return "".join(secrets.choice(ROOM_CODE_ALPHABET) for _ in range(length))


def create_ws_ticket(participant_id: uuid.UUID, room_code: str) -> tuple[str, datetime]:
    settings = get_settings()
    now = datetime.now(UTC)
    expires = now + timedelta(seconds=settings.ws_ticket_ttl_seconds)
    payload = {
        "sub": str(participant_id),
        "room": room_code,
        "jti": str(uuid.uuid4()),
        "iat": now,
        "exp": expires,
    }
    return jwt.encode(payload, settings.app_secret_key, algorithm="HS256"), expires
