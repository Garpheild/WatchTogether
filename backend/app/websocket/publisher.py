import uuid
from datetime import datetime

from app.core.db import SessionFactory
from app.realtime.manager import ConnectionManager
from app.realtime.protocol import (
    CLOSE_FORBIDDEN,
    CLOSE_ROOM_CLOSED,
    PARTICIPANT_LEFT,
    ROOM_CLOSED,
    now_iso,
    server_event,
    to_iso,
)
from app.rooms.repository import RoomRepository
from app.websocket.views import load_participants_payload


class RealtimeEventPublisher:
    """Adapter from REST lifecycle actions to WebSocket room broadcasts."""

    def __init__(self, manager: ConnectionManager) -> None:
        self.manager = manager

    async def participant_left(self, room_code: str, participant_id: str) -> None:
        participant_uuid = uuid.UUID(participant_id)
        self.manager.mark_participant_left(room_code, participant_uuid)

        async with SessionFactory() as session:
            room = await RoomRepository(session).get_by_code(room_code)
            participants = (
                await load_participants_payload(session, room, self.manager)
                if room is not None
                else []
            )
        await self.manager.broadcast(
            room_code,
            server_event(
                PARTICIPANT_LEFT,
                room_code,
                {
                    "participant_id": str(participant_uuid),
                    "participants": participants,
                },
            ),
        )
        await self.manager.close_participant(room_code, participant_uuid, CLOSE_FORBIDDEN)

    async def room_closed(
        self,
        room_code: str,
        closed_at: str,
        closed_by_participant_id: str | None = None,
    ) -> None:
        self.manager.mark_room_closed(room_code)
        try:
            normalized = to_iso(datetime.fromisoformat(closed_at))
        except ValueError:
            normalized = now_iso()
        await self.manager.broadcast(
            room_code,
            server_event(
                ROOM_CLOSED,
                room_code,
                {
                    "room_code": room_code,
                    "closed_at": normalized,
                    "closed_by_participant_id": closed_by_participant_id,
                },
            ),
        )
        await self.manager.close_room(room_code, CLOSE_ROOM_CLOSED)
