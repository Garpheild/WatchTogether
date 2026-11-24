import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, Double, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class PlaybackState(Base):
    __tablename__ = "playback_states"

    room_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rooms.id", ondelete="CASCADE"),
        primary_key=True,
    )
    video_id: Mapped[str | None] = mapped_column(String(11))
    is_playing: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    position_seconds: Mapped[float] = mapped_column(Double, nullable=False, default=0.0)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_by_participant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("participants.id", ondelete="SET NULL"),
    )

    __table_args__ = (
        CheckConstraint(
            "video_id IS NULL OR video_id ~ '^[A-Za-z0-9_-]{11}$'",
            name="ck_playback_video_id",
        ),
        CheckConstraint(
            "position_seconds >= 0 AND position_seconds <= 86400",
            name="ck_playback_position",
        ),
        CheckConstraint("revision >= 0", name="ck_playback_revision"),
        CheckConstraint(
            "video_id IS NOT NULL OR (is_playing = false AND position_seconds = 0)",
            name="ck_playback_without_video",
        ),
    )
