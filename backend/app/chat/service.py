import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.chat.models import Message
from app.chat.repository import ChatRepository
from app.core.clock import Clock
from app.core.errors import RoomClosed, ValidationError
from app.participants.models import Participant
from app.rooms.models import Room


def validate_message_text(text: str) -> str:
    value = text.strip()
    if any(ord(char) < 32 and char != "\n" for char in value):
        raise ValidationError(
            {
                "fields": [
                    {
                        "field": "text",
                        "reason": "control characters are not allowed except newline",
                    }
                ]
            }
        )
    if not 1 <= len(value) <= 500:
        raise ValidationError(
            {"fields": [{"field": "text", "reason": "must be 1..500 characters after trim"}]}
        )
    return value


async def send_message(
    session: AsyncSession,
    clock: Clock,
    room: Room,
    participant: Participant,
    text: str,
    client_message_id: uuid.UUID,
) -> tuple[Message, bool]:
    """Persist a chat message. Returns (message, created); duplicates are returned as-is."""
    if room.status != "active":
        raise RoomClosed()
    value = validate_message_text(text)
    repo = ChatRepository(session)
    existing = await repo.find_by_client_id(participant.id, client_message_id)
    if existing is not None:
        return existing[0], False

    message = Message(
        room_id=room.id,
        participant_id=participant.id,
        text=value,
        client_message_id=client_message_id,
        created_at=clock.now(),
    )
    try:
        async with session.begin_nested():
            await repo.add(message)
    except IntegrityError:
        duplicate = await repo.find_by_client_id(participant.id, client_message_id)
        if duplicate is None:
            raise
        return duplicate[0], False
    return message, True
