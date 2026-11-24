import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Participant(Base):
    __tablename__ = "participants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False
    )
    display_name: Mapped[str] = mapped_column(String(32), nullable=False)
    role: Mapped[str] = mapped_column(String(8), nullable=False, default="member")
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    connected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    disconnected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint("role IN ('owner', 'member')", name="ck_participants_role"),
        CheckConstraint(
            "char_length(btrim(display_name)) BETWEEN 1 AND 32",
            name="ck_participants_display_name",
        ),
        CheckConstraint("token_hash ~ '^[0-9a-f]{64}$'", name="ck_participants_token_hash"),
        UniqueConstraint("token_hash", name="uq_participants_token_hash"),
        Index("ix_participants_room_id", "room_id"),
        Index(
            "uq_participants_room_display_name",
            "room_id",
            text("lower(display_name)"),
            unique=True,
            postgresql_where=text("left_at IS NULL"),
        ),
        Index(
            "uq_participants_room_owner",
            "room_id",
            unique=True,
            postgresql_where=text("role = 'owner'"),
        ),
    )
