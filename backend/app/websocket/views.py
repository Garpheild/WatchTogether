import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.chat.models import Message
from app.chat.repository import ChatRepository
from app.core.youtube import canonical_youtube_url
from app.participants.models import Participant
from app.participants.repository import ParticipantRepository
from app.playback.models import PlaybackState
from app.playback.repository import PlaybackRepository
from app.realtime.manager import ConnectionManager
from app.realtime.protocol import to_iso
from app.rooms.models import Room


def room_payload(room: Room) -> dict[str, Any]:
    return {
        "room_code": room.code,
        "title": room.title,
        "status": room.status,
        "max_participants": room.max_participants,
        "created_at": to_iso(room.created_at),
        "closed_at": to_iso(room.closed_at) if room.closed_at is not None else None,
    }


def playback_payload(state: PlaybackState) -> dict[str, Any]:
    return {
        "video_id": state.video_id,
        "video_url": canonical_youtube_url(state.video_id),
        "is_playing": state.is_playing,
        "position_seconds": state.position_seconds,
        "updated_at": to_iso(state.updated_at),
        "revision": state.revision,
        "updated_by_participant_id": (
            str(state.updated_by_participant_id)
            if state.updated_by_participant_id is not None
            else None
        ),
    }


def participant_payload(participant: Participant, online: set[uuid.UUID]) -> dict[str, Any]:
    return {
        "participant_id": str(participant.id),
        "display_name": participant.display_name,
        "role": participant.role,
        "is_online": participant.id in online,
        "joined_at": to_iso(participant.joined_at),
    }


def participants_payload(
    participants: list[Participant], online: set[uuid.UUID]
) -> list[dict[str, Any]]:
    return [participant_payload(participant, online) for participant in participants]


def message_payload(message: Message, participant: Participant, room_code: str) -> dict[str, Any]:
    return {
        "message_id": message.id,
        "room_code": room_code,
        "participant_id": str(message.participant_id),
        "display_name": participant.display_name,
        "text": message.text,
        "created_at": to_iso(message.created_at),
        "client_message_id": (
            str(message.client_message_id) if message.client_message_id is not None else None
        ),
    }


async def load_playback(session: AsyncSession, room: Room) -> PlaybackState:
    state = await PlaybackRepository(session).get_by_room_id(room.id)
    if state is None:
        raise RuntimeError("playback state is missing for the room")
    return state


async def load_participants_payload(
    session: AsyncSession, room: Room, manager: ConnectionManager
) -> list[dict[str, Any]]:
    participants = await ParticipantRepository(session).list_active(room.id)
    online = await manager.online_participant_ids(room.code)
    return participants_payload(participants, online)


async def load_snapshot(
    session: AsyncSession,
    room: Room,
    participant: Participant,
    manager: ConnectionManager,
) -> dict[str, Any]:
    state = await load_playback(session, room)
    participants = await ParticipantRepository(session).list_active(room.id)
    online = await manager.online_participant_ids(room.code)
    rows = await ChatRepository(session).history(room.id, 50, None)
    page = list(reversed(rows[:50]))
    return {
        "room": room_payload(room),
        "playback": playback_payload(state),
        "participants": participants_payload(participants, online),
        "messages": [
            message_payload(message, message_author, room.code) for message, message_author in page
        ],
        "you": {"participant_id": str(participant.id), "role": participant.role},
    }


async def load_playback_payload(session: AsyncSession, room: Room) -> dict[str, Any]:
    return playback_payload(await load_playback(session, room))
