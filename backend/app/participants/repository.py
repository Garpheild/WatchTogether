import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.participants.models import Participant


class ParticipantRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def find_by_token_hash(self, token_hash: str) -> Participant | None:
        result = await self.session.execute(
            select(Participant).where(Participant.token_hash == token_hash)
        )
        return result.scalar_one_or_none()

    async def find_by_id(self, participant_id: uuid.UUID) -> Participant | None:
        result = await self.session.execute(
            select(Participant).where(Participant.id == participant_id)
        )
        return result.scalar_one_or_none()

    async def list_active(self, room_id: uuid.UUID) -> list[Participant]:
        result = await self.session.execute(
            select(Participant)
            .where(Participant.room_id == room_id, Participant.left_at.is_(None))
            .order_by(
                (Participant.role != "owner"),
                Participant.joined_at,
            )
        )
        return list(result.scalars())

    async def count_active(self, room_id: uuid.UUID) -> int:
        result = await self.session.execute(
            select(func.count())
            .select_from(Participant)
            .where(Participant.room_id == room_id, Participant.left_at.is_(None))
        )
        return int(result.scalar_one())

    async def name_exists(self, room_id: uuid.UUID, display_name: str) -> bool:
        result = await self.session.execute(
            select(Participant.id).where(
                Participant.room_id == room_id,
                Participant.left_at.is_(None),
                func.lower(Participant.display_name) == display_name.lower(),
            )
        )
        return result.scalar_one_or_none() is not None

    async def add(self, participant: Participant) -> Participant:
        self.session.add(participant)
        await self.session.flush()
        return participant

    async def leave(self, participant: Participant, now: datetime) -> bool:
        if participant.left_at is not None:
            return False
        participant.left_at = now
        participant.disconnected_at = participant.disconnected_at or now
        await self.session.flush()
        return True
