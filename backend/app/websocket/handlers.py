import logging
import time
import uuid
from collections.abc import Awaitable, Callable
from typing import Any, TypeVar

from pydantic import BaseModel
from pydantic import ValidationError as PydanticValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.chat.service import send_message
from app.core.clock import Clock, SystemClock
from app.core.config import get_settings
from app.core.db import SessionFactory
from app.core.errors import (
    AppError,
    Forbidden,
    InvalidToken,
    RateLimited,
    RoomClosed,
    RoomNotFound,
    ValidationError,
)
from app.core.rate_limit import TokenBucket
from app.participants.models import Participant
from app.participants.repository import ParticipantRepository
from app.playback.service import change_video, handle_command
from app.realtime.manager import Connection, ConnectionManager
from app.realtime.protocol import (
    CHAT_MESSAGE,
    CHAT_SEND,
    CLOSE_POLICY_VIOLATION,
    CLOSE_RATE_LIMITED,
    PING,
    PLAYBACK_COMMAND,
    PLAYBACK_STATE,
    PLAYBACK_SYNC_REQUEST,
    PONG,
    ROOM_SNAPSHOT,
    ROOM_SYNC_REQUEST,
    VIDEO_CHANGE,
    ChatSendPayload,
    ClientEnvelope,
    EmptyPayload,
    PingPayload,
    PlaybackCommandPayload,
    VideoChangePayload,
    error_event,
    server_event,
    validation_details,
)
from app.rooms.models import Room
from app.rooms.repository import RoomRepository
from app.websocket.views import (
    load_playback_payload,
    load_snapshot,
    message_payload,
    playback_payload,
)

logger = logging.getLogger(__name__)

PayloadT = TypeVar("PayloadT", bound=BaseModel)

PROTOCOL_ERROR_WINDOW_SECONDS = 10.0
PROTOCOL_ERROR_LIMIT = 5
RATE_LIMIT_WINDOW_SECONDS = 10.0
RATE_LIMIT_HIT_LIMIT = 5
ACTIVITY_TOUCH_INTERVAL_SECONDS = 60.0


class RoomEventHandler:
    def __init__(self, manager: ConnectionManager, clock: Clock | None = None) -> None:
        self.manager = manager
        self.clock = clock or SystemClock()
        self._playback_limit = TokenBucket(rate=5, burst=10)
        self._chat_limit = TokenBucket(rate=1, burst=5)
        self._sync_limit = TokenBucket(rate=1 / 5, burst=1)
        self._video_limit = TokenBucket(rate=1 / 2, burst=1)
        self._ping_limit = TokenBucket(rate=1 / 5, burst=1)
        self._last_activity: dict[str, float] = {}
        self._handlers: dict[str, Callable[[Connection, ClientEnvelope], Awaitable[bool]]] = {
            ROOM_SYNC_REQUEST: self._handle_room_sync,
            PLAYBACK_SYNC_REQUEST: self._handle_playback_sync,
            PLAYBACK_COMMAND: self._handle_playback_command,
            VIDEO_CHANGE: self._handle_video_change,
            CHAT_SEND: self._handle_chat_send,
            PING: self._handle_ping,
        }

    async def handle(self, connection: Connection, raw: str) -> bool:
        try:
            envelope = ClientEnvelope.model_validate_json(raw)
        except PydanticValidationError as exc:
            await self._send_error(
                connection,
                None,
                "validation_error",
                "Request validation failed",
                validation_details(exc),
            )
            return await self._note_protocol_error(connection)

        handler = self._handlers.get(envelope.type)
        if handler is None:
            await self._send_error(
                connection,
                envelope.request_id,
                "unsupported_event",
                f"Unsupported event type: {envelope.type}",
            )
            return await self._note_protocol_error(connection)

        try:
            return await handler(connection, envelope)
        except RateLimited as exc:
            await self._send_error(
                connection,
                envelope.request_id,
                "rate_limited",
                exc.message,
                exc.details,
            )
            return await self._note_rate_limited(connection)
        except AppError as exc:
            await self._send_error(
                connection, envelope.request_id, exc.code, exc.message, exc.details
            )
            return True
        except Exception:
            logger.exception(
                "WebSocket event %s failed for %s", envelope.type, connection.participant_id
            )
            await self._send_error(
                connection,
                envelope.request_id,
                "internal_error",
                "Internal server error",
            )
            return True

    async def _handle_room_sync(self, connection: Connection, envelope: ClientEnvelope) -> bool:
        self._sync_limit.require(str(connection.participant_id))
        self._parse_payload(EmptyPayload, envelope)
        async with SessionFactory() as session:
            room, participant = await self._load_context(session, connection)
            snapshot = await load_snapshot(session, room, participant, self.manager)
        await self.manager.send(
            connection,
            server_event(ROOM_SNAPSHOT, connection.room_code, snapshot, envelope.request_id),
        )
        return True

    async def _handle_playback_sync(self, connection: Connection, envelope: ClientEnvelope) -> bool:
        self._sync_limit.require(str(connection.participant_id))
        self._parse_payload(EmptyPayload, envelope)
        async with SessionFactory() as session:
            room, _participant = await self._load_context(session, connection)
            payload = await load_playback_payload(session, room)
        await self.manager.send(
            connection,
            server_event(
                PLAYBACK_STATE,
                connection.room_code,
                {"reason": "sync_request", "playback": payload},
                envelope.request_id,
            ),
        )
        return True

    async def _handle_playback_command(
        self, connection: Connection, envelope: ClientEnvelope
    ) -> bool:
        self._playback_limit.require(str(connection.participant_id))
        payload = self._parse_payload(PlaybackCommandPayload, envelope)
        settings = get_settings()

        async with self.manager.room_lock(connection.room_code):
            async with SessionFactory() as session:
                async with session.begin():
                    room, participant = await self._load_context(session, connection)
                    state, changed = await handle_command(
                        session,
                        self.clock,
                        room,
                        participant,
                        payload.action,
                        payload.position_seconds,
                        settings.playback_position_tolerance_seconds,
                    )
                    self._touch_activity(room)

        event_payload = {"reason": "command", "playback": playback_payload(state)}
        if changed:
            await self.manager.broadcast(
                connection.room_code,
                server_event(PLAYBACK_STATE, connection.room_code, event_payload),
            )
        else:
            await self.manager.send(
                connection,
                server_event(
                    PLAYBACK_STATE,
                    connection.room_code,
                    event_payload,
                    envelope.request_id,
                ),
            )
        return True

    async def _handle_video_change(self, connection: Connection, envelope: ClientEnvelope) -> bool:
        self._video_limit.require(str(connection.participant_id))
        payload = self._parse_payload(VideoChangePayload, envelope)
        if connection.role != "owner":
            raise Forbidden("Only the owner can change the video")

        async with self.manager.room_lock(connection.room_code):
            async with SessionFactory() as session:
                async with session.begin():
                    room, participant = await self._load_context(session, connection)
                    if participant.role != "owner":
                        raise Forbidden("Only the owner can change the video")
                    state = await change_video(
                        session, self.clock, room, participant, payload.video_url
                    )
                    self._touch_activity(room)

        await self.manager.broadcast(
            connection.room_code,
            server_event(
                PLAYBACK_STATE,
                connection.room_code,
                {"reason": "video_change", "playback": playback_payload(state)},
            ),
        )
        return True

    async def _handle_chat_send(self, connection: Connection, envelope: ClientEnvelope) -> bool:
        self._chat_limit.require(str(connection.participant_id))
        payload = self._parse_payload(ChatSendPayload, envelope)

        async with SessionFactory() as session:
            async with session.begin():
                room, participant = await self._load_context(session, connection)
                message, _created = await send_message(
                    session,
                    self.clock,
                    room,
                    participant,
                    payload.text,
                    payload.client_message_id,
                )
                self._touch_activity(room)

        await self.manager.broadcast(
            connection.room_code,
            server_event(
                CHAT_MESSAGE,
                connection.room_code,
                {"message": message_payload(message, participant, room.code)},
            ),
        )
        return True

    async def _handle_ping(self, connection: Connection, envelope: ClientEnvelope) -> bool:
        self._ping_limit.require(str(connection.participant_id))
        payload = self._parse_payload(PingPayload, envelope)
        await self.manager.send(
            connection,
            server_event(
                PONG,
                connection.room_code,
                {"client_time": payload.client_time},
                envelope.request_id,
            ),
        )
        return True

    async def _load_context(
        self, session: AsyncSession, connection: Connection
    ) -> tuple[Room, Participant]:
        room = await RoomRepository(session).get_by_code(connection.room_code)
        if room is None:
            raise RoomNotFound()
        if room.status != "active":
            raise RoomClosed()
        participant = await ParticipantRepository(session).find_by_id(connection.participant_id)
        if participant is None:
            raise InvalidToken()
        if participant.left_at is not None or participant.room_id != room.id:
            raise Forbidden("Participant has left the room")
        return room, participant

    def _parse_payload(self, model: type[PayloadT], envelope: ClientEnvelope) -> PayloadT:
        try:
            return model.model_validate(envelope.payload)
        except PydanticValidationError as exc:
            raise ValidationError(validation_details(exc)) from exc

    def _touch_activity(self, room: Room) -> None:
        key = room.code
        now_monotonic = time.monotonic()
        if now_monotonic - self._last_activity.get(key, 0.0) >= (ACTIVITY_TOUCH_INTERVAL_SECONDS):
            room.last_activity_at = self.clock.now()
            self._last_activity[key] = now_monotonic

    async def _send_error(
        self,
        connection: Connection,
        request_id: uuid.UUID | None,
        code: str,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        await self.manager.send(
            connection,
            error_event(connection.room_code, request_id, code, message, details),
        )

    async def _note_protocol_error(self, connection: Connection) -> bool:
        now = time.monotonic()
        while (
            connection.protocol_errors
            and now - connection.protocol_errors[0] > PROTOCOL_ERROR_WINDOW_SECONDS
        ):
            connection.protocol_errors.popleft()
        connection.protocol_errors.append(now)
        if len(connection.protocol_errors) >= PROTOCOL_ERROR_LIMIT:
            await connection.websocket.close(code=CLOSE_POLICY_VIOLATION)
            return False
        return True

    async def _note_rate_limited(self, connection: Connection) -> bool:
        now = time.monotonic()
        while (
            connection.rate_limit_hits
            and now - connection.rate_limit_hits[0] > RATE_LIMIT_WINDOW_SECONDS
        ):
            connection.rate_limit_hits.popleft()
        connection.rate_limit_hits.append(now)
        if len(connection.rate_limit_hits) >= RATE_LIMIT_HIT_LIMIT:
            await connection.websocket.close(code=CLOSE_RATE_LIMITED)
            return False
        return True
