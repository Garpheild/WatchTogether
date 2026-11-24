from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.rooms.models import Room


class RoomRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_code(self, code: str) -> Room | None:
        result = await self.session.execute(select(Room).where(Room.code == code))
        return result.scalar_one_or_none()

    async def get_by_code_for_update(self, code: str) -> Room | None:
        result = await self.session.execute(select(Room).where(Room.code == code).with_for_update())
        return result.scalar_one_or_none()

    async def add(self, room: Room) -> Room:
        self.session.add(room)
        await self.session.flush()
        return room

    async def close(self, room: Room, now: datetime) -> bool:
        if room.status == "closed":
            return False
        room.status = "closed"
        room.closed_at = now
        room.last_activity_at = now
        await self.session.flush()
        return True
