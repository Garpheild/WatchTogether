import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock
from app.core.security import (
    generate_access_token,
    generate_room_code,
    hash_access_token,
)
from app.participants.models import Participant
from app.playback.models import PlaybackState
from app.rooms.models import Room


async def create_room(
    session: AsyncSession,
    clock: Clock,
    display_name: str,
    title: str | None,
    video_id: str | None,
    max_participants: int,
) -> tuple[Room, Participant, PlaybackState, str]:
    now = clock.now()
    access_token = generate_access_token()

    for _ in range(5):
        room = Room(
            id=uuid.uuid4(),
            code=generate_room_code(),
            title=title,
            status="active",
            max_participants=max_participants,
            created_at=now,
            closed_at=None,
            last_activity_at=now,
        )
        participant = Participant(
            room_id=room.id,
            display_name=display_name,
            role="owner",
            token_hash=hash_access_token(access_token),
            joined_at=now,
            last_seen_at=now,
            left_at=None,
        )
        playback = PlaybackState(
            room_id=room.id,
            video_id=video_id,
            is_playing=False,
            position_seconds=0.0,
            revision=0,
            updated_at=now,
            updated_by_participant_id=None,
        )
        session.add(room)
        try:
            # Flush the room first so participants.playback can reference it.
            await session.flush()
            session.add_all([participant, playback])
            await session.flush()
            return room, participant, playback, access_token
        except IntegrityError as exc:
            await session.rollback()
            if "uq_rooms_code" not in str(exc):
                raise
    raise RuntimeError("Could not allocate a unique room code")
