import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Index, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(12), nullable=False)
    title: Mapped[str | None] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    max_participants: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_activity_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        UniqueConstraint("code", name="uq_rooms_code"),
        CheckConstraint("status IN ('active', 'closed')", name="ck_rooms_status"),
        CheckConstraint("max_participants BETWEEN 2 AND 10", name="ck_rooms_max_participants"),
        CheckConstraint(
            "(status = 'closed') = (closed_at IS NOT NULL)",
            name="ck_rooms_closed_at",
        ),
        Index("ix_rooms_status_last_activity", "status", "last_activity_at"),
    )
