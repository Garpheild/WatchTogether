import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.playback.models import PlaybackState


class PlaybackRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_room_id(self, room_id: uuid.UUID) -> PlaybackState | None:
        result = await self.session.execute(
            select(PlaybackState).where(PlaybackState.room_id == room_id)
        )
        return result.scalar_one_or_none()

    async def get_by_room_id_for_update(self, room_id: uuid.UUID) -> PlaybackState | None:
        result = await self.session.execute(
            select(PlaybackState).where(PlaybackState.room_id == room_id).with_for_update()
        )
        return result.scalar_one_or_none()
