import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.chat.models import Message
from app.participants.models import Participant


class ChatRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def history(
        self, room_id: uuid.UUID, limit: int, before_id: int | None
    ) -> list[tuple[Message, Participant]]:
        query = (
            select(Message, Participant)
            .join(Participant, Participant.id == Message.participant_id)
            .where(Message.room_id == room_id)
        )
        if before_id is not None:
            query = query.where(Message.id < before_id)
        query = query.order_by(Message.id.desc()).limit(limit + 1)
        result = await self.session.execute(query)
        return list(result.all())
