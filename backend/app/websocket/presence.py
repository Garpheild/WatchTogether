import logging
import uuid

from app.core.clock import Clock, SystemClock
from app.core.db import SessionFactory
from app.participants.repository import ParticipantRepository
from app.realtime.manager import ConnectionManager
from app.realtime.protocol import PARTICIPANT_LEFT, server_event
from app.rooms.repository import RoomRepository
from app.websocket.auth import AuthContext
from app.websocket.views import load_participants_payload

logger = logging.getLogger(__name__)


class PresenceService:
    def __init__(self, manager: ConnectionManager, clock: Clock | None = None) -> None:
        self.manager = manager
        self.clock = clock or SystemClock()

    async def mark_connected(self, context: AuthContext) -> None:
        async with SessionFactory() as session:
            async with session.begin():
                participant = await ParticipantRepository(session).find_by_id(
                    context.participant_id
                )
                if participant is None:
                    return
                now = self.clock.now()
                participant.connected_at = now
                participant.disconnected_at = None
                participant.last_seen_at = now

    async def joined_payload(
        self, room_code: str, participant_id: uuid.UUID
    ) -> dict[str, object] | None:
        async with SessionFactory() as session:
            room = await RoomRepository(session).get_by_code(room_code)
            if room is None:
                return None
            participants = await load_participants_payload(session, room, self.manager)
        participant = next(
            (item for item in participants if item["participant_id"] == str(participant_id)),
            None,
        )
        if participant is None:
            return None
        return {"participant": participant, "participants": participants}

    async def grace_expired(self, room_code: str, participant_id: uuid.UUID) -> None:
        if not await self.manager.finalize_disconnect(room_code, participant_id):
            return

        async with SessionFactory() as session:
            async with session.begin():
                room = await RoomRepository(session).get_by_code(room_code)
                if room is None or room.status != "active":
                    return
                participant = await ParticipantRepository(session).find_by_id(participant_id)
                if participant is None or participant.left_at is not None:
                    return
                if participant.disconnected_at is None:
                    participant.disconnected_at = self.clock.now()
                participants = await load_participants_payload(session, room, self.manager)

        await self.manager.broadcast(
            room_code,
            server_event(
                PARTICIPANT_LEFT,
                room_code,
                {
                    "participant_id": str(participant_id),
                    "participants": participants,
                },
            ),
        )
