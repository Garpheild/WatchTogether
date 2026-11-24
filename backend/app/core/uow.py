from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import SessionFactory


class UnitOfWork:
    def __init__(self) -> None:
        self.session: AsyncSession | None = None

    @asynccontextmanager
    async def transaction(self) -> AsyncIterator[AsyncSession]:
        async with SessionFactory() as session:
            async with session.begin():
                self.session = session
                try:
                    yield session
                finally:
                    self.session = None
