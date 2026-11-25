import logging
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, WebSocket
from starlette.websockets import WebSocketDisconnect

from app.core.config import get_settings
from app.core.db import SessionFactory
from app.participants.repository import ParticipantRepository
from app.realtime.manager import (
    Connection,
    ConnectionLimitExceeded,
    RoomIsClosed,
)
from app.realtime.protocol import (
    CLOSE_INVALID_TICKET,
    CLOSE_MESSAGE_TOO_BIG,
    CLOSE_RATE_LIMITED,
    CLOSE_ROOM_CLOSED,
    MAX_MESSAGE_BYTES,
    PARTICIPANT_JOINED,
    ROOM_SNAPSHOT,
    server_event,
)
from app.rooms.repository import RoomRepository
from app.websocket.auth import WSAuthError, authenticate
from app.websocket.runtime import RealtimeRuntime
from app.websocket.views import load_snapshot

logger = logging.getLogger(__name__)

router = APIRouter()

CLOSE_INTERNAL_ERROR = 1011


@router.websocket("/ws/rooms/{room_code}")
async def room_socket(websocket: WebSocket, room_code: str, ticket: str | None = None) -> None:
    runtime = _runtime(websocket)
    if runtime is None:
        await websocket.close(code=CLOSE_INTERNAL_ERROR)
        return

    try:
        context = await authenticate(websocket, room_code, ticket)
    except WSAuthError as exc:
        await websocket.close(code=exc.code)
        return

    if not await runtime.manager.can_connect(room_code, context.participant_id):
        await websocket.close(code=CLOSE_RATE_LIMITED)
        return

    await websocket.accept()
    connection = Connection(
        websocket=websocket,
        room_code=context.room_code,
        participant_id=context.participant_id,
        role=context.role,
        connected_at=datetime.now(UTC),
    )
    try:
        became_online = await runtime.manager.register(connection)
    except RoomIsClosed:
        await websocket.close(code=CLOSE_ROOM_CLOSED)
        return
    except ConnectionLimitExceeded:
        await websocket.close(code=CLOSE_RATE_LIMITED)
        return

    try:
        if became_online:
            await runtime.presence.mark_connected(context)

        snapshot = await _build_snapshot(context.room_code, context.participant_id, runtime)
        if snapshot is None:
            await websocket.close(code=CLOSE_INVALID_TICKET)
            return
        await runtime.manager.send(
            connection,
            server_event(ROOM_SNAPSHOT, context.room_code, snapshot),
        )

        if became_online:
            joined = await runtime.presence.joined_payload(
                context.room_code, context.participant_id
            )
            if joined is not None:
                await runtime.manager.broadcast(
                    context.room_code,
                    server_event(PARTICIPANT_JOINED, context.room_code, joined),
                    exclude_participant=context.participant_id,
                )

        while True:
            raw = await websocket.receive_text()
            if len(raw.encode("utf-8")) > MAX_MESSAGE_BYTES:
                await websocket.close(code=CLOSE_MESSAGE_TOO_BIG)
                break
            if not await runtime.handler.handle(connection, raw):
                break
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("WebSocket connection failed for room %s", room_code)
        await websocket.close(code=CLOSE_INTERNAL_ERROR)
    finally:
        became_offline = await runtime.manager.unregister(connection)
        if became_offline and not runtime.manager.is_room_closed(room_code):
            runtime.manager.schedule_grace(
                room_code,
                context.participant_id,
                get_settings().presence_grace_seconds,
                runtime.presence.grace_expired,
            )


def _runtime(websocket: WebSocket) -> RealtimeRuntime | None:
    runtime = getattr(websocket.app.state, "realtime", None)
    return runtime if isinstance(runtime, RealtimeRuntime) else None


async def _build_snapshot(
    room_code: str,
    participant_id: uuid.UUID,
    runtime: RealtimeRuntime,
) -> dict[str, object] | None:
    async with SessionFactory() as session:
        room = await RoomRepository(session).get_by_code(room_code)
        if room is None:
            return None
        participant = await ParticipantRepository(session).find_by_id(participant_id)
        if participant is None:
            return None
        return await load_snapshot(session, room, participant, runtime.manager)
