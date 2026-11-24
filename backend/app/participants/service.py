from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import Forbidden, InvalidToken
from app.core.security import hash_access_token
from app.participants.models import Participant
from app.participants.repository import ParticipantRepository
from app.rooms.models import Room


async def resolve_principal(
    session: AsyncSession, access_token: str | None, room_code: str
) -> tuple[Room, Participant]:
    if not access_token:
        raise InvalidToken()
    participant = await ParticipantRepository(session).find_by_token_hash(
        hash_access_token(access_token)
    )
    if participant is None:
        raise InvalidToken()
    if participant.left_at is not None:
        raise Forbidden("Participant has left the room")

    from app.rooms.repository import RoomRepository

    room = await RoomRepository(session).get_by_code(room_code)
    if room is None:
        from app.core.errors import RoomNotFound

        raise RoomNotFound()
    if participant.room_id != room.id:
        raise Forbidden("Token belongs to another room")
    return room, participant
