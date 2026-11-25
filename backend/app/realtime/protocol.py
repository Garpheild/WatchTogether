import uuid
from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, ValidationError

# Event names (see docs/WEBSOCKET.md, section 4).
ROOM_SNAPSHOT = "room.snapshot"
ROOM_SYNC_REQUEST = "room.sync.request"
PLAYBACK_COMMAND = "playback.command"
PLAYBACK_STATE = "playback.state"
PLAYBACK_SYNC_REQUEST = "playback.sync.request"
VIDEO_CHANGE = "video.change"
CHAT_SEND = "chat.send"
CHAT_MESSAGE = "chat.message"
PARTICIPANT_JOINED = "participant.joined"
PARTICIPANT_LEFT = "participant.left"
ROOM_CLOSED = "room.closed"
PING = "ping"
PONG = "pong"
ERROR = "error"

MAX_MESSAGE_BYTES = 4 * 1024

CLOSE_NORMAL = 1000
CLOSE_GOING_AWAY = 1001
CLOSE_POLICY_VIOLATION = 1008
CLOSE_MESSAGE_TOO_BIG = 1009
CLOSE_SERVICE_RESTART = 1012
CLOSE_INVALID_TICKET = 4401
CLOSE_FORBIDDEN = 4403
CLOSE_ROOM_NOT_FOUND = 4404
CLOSE_ROOM_CLOSED = 4409
CLOSE_RATE_LIMITED = 4429


def to_iso(value: datetime) -> str:
    """Serialize a datetime as ISO 8601 UTC with exactly three fractional digits."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    value = value.astimezone(UTC)
    return f"{value:%Y-%m-%dT%H:%M:%S}.{value.microsecond // 1000:03d}Z"


def now_iso() -> str:
    return to_iso(datetime.now(UTC))


def _request_id(value: uuid.UUID | str | None) -> str | None:
    if value is None:
        return None
    return str(value)


class ClientEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: str
    request_id: uuid.UUID | None = None
    payload: dict[str, Any] = {}


class EmptyPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PlaybackCommandPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["play", "pause", "seek"]
    position_seconds: float


class PlaybackSyncPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")


class VideoChangePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    video_url: str


class ChatSendPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str
    client_message_id: uuid.UUID


class PingPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    client_time: str | None = None


def server_event(
    event_type: str,
    room_code: str,
    payload: dict[str, Any],
    request_id: uuid.UUID | str | None = None,
) -> dict[str, Any]:
    return {
        "type": event_type,
        "event_id": str(uuid.uuid4()),
        "room_code": room_code,
        "server_time": now_iso(),
        "request_id": _request_id(request_id),
        "payload": payload,
    }


def error_event(
    room_code: str,
    request_id: uuid.UUID | str | None,
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return server_event(
        ERROR,
        room_code,
        {"code": code, "message": message, "details": details},
        request_id,
    )


def validation_details(exc: ValidationError) -> dict[str, Any]:
    fields = []
    for error in exc.errors():
        field = ".".join(str(part) for part in error["loc"])
        fields.append({"field": field, "reason": error["msg"]})
    return {"fields": fields}
