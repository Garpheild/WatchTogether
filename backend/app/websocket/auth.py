import asyncio
import time
import uuid
from dataclasses import dataclass
from typing import Any

import jwt
from starlette.websockets import WebSocket

from app.core.config import get_settings
from app.core.db import SessionFactory
from app.participants.repository import ParticipantRepository
from app.realtime.protocol import (
    CLOSE_FORBIDDEN,
    CLOSE_INVALID_TICKET,
    CLOSE_ROOM_CLOSED,
    CLOSE_ROOM_NOT_FOUND,
)
from app.rooms.repository import RoomRepository


class WSAuthError(Exception):
    def __init__(self, code: int) -> None:
        super().__init__(f"websocket handshake rejected with code {code}")
        self.code = code


@dataclass(frozen=True)
class AuthContext:
    room_code: str
    room_id: uuid.UUID
    participant_id: uuid.UUID
    role: str
    display_name: str


class _TicketReplayCache:
    def __init__(self) -> None:
        self._expirations: dict[str, float] = {}
        self._lock = asyncio.Lock()

    async def consume(self, jti: str, expires_at: float) -> bool:
        async with self._lock:
            now = time.time()
            for key, expiry in list(self._expirations.items()):
                if expiry <= now:
                    self._expirations.pop(key, None)
            if jti in self._expirations:
                return False
            self._expirations[jti] = expires_at
            return True


_ticket_cache = _TicketReplayCache()


def _check_origin(websocket: WebSocket) -> None:
    origin = websocket.headers.get("origin")
    if origin is None:
        # Non-browser clients (tests, CLI) do not send Origin.
        return
    if origin not in get_settings().allowed_origins:
        raise WSAuthError(CLOSE_FORBIDDEN)


def _decode_ticket(ticket: str, room_code: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        claims = jwt.decode(
            ticket,
            settings.app_secret_key,
            algorithms=["HS256"],
            options={"require": ["sub", "room", "jti", "iat", "exp"]},
        )
    except jwt.InvalidTokenError as exc:
        raise WSAuthError(CLOSE_INVALID_TICKET) from exc
    if claims.get("room") != room_code:
        raise WSAuthError(CLOSE_FORBIDDEN)
    return claims


async def authenticate(websocket: WebSocket, room_code: str, ticket: str | None) -> AuthContext:
    _check_origin(websocket)
    if not ticket:
        raise WSAuthError(CLOSE_INVALID_TICKET)

    claims = _decode_ticket(ticket, room_code)
    try:
        participant_id = uuid.UUID(str(claims["sub"]))
        expires_at = float(claims["exp"])
        jti = str(claims["jti"])
    except (KeyError, ValueError) as exc:
        raise WSAuthError(CLOSE_INVALID_TICKET) from exc

    if not await _ticket_cache.consume(jti, expires_at):
        raise WSAuthError(CLOSE_INVALID_TICKET)

    async with SessionFactory() as session:
        participant = await ParticipantRepository(session).find_by_id(participant_id)
        if participant is None:
            raise WSAuthError(CLOSE_INVALID_TICKET)
        room = await RoomRepository(session).get_by_code(room_code)
        if room is None:
            raise WSAuthError(CLOSE_ROOM_NOT_FOUND)
        if participant.room_id != room.id:
            raise WSAuthError(CLOSE_FORBIDDEN)
        if participant.left_at is not None:
            raise WSAuthError(CLOSE_FORBIDDEN)
        if room.status != "active":
            raise WSAuthError(CLOSE_ROOM_CLOSED)
        return AuthContext(
            room_code=room.code,
            room_id=room.id,
            participant_id=participant.id,
            role=participant.role,
            display_name=participant.display_name,
        )
