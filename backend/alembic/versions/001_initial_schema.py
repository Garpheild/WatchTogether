"""initial schema

Revision ID: 001_initial
Revises:
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    op.create_table(
        "rooms",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(length=12), nullable=False),
        sa.Column("title", sa.String(length=80), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
        sa.Column("max_participants", sa.SmallInteger(), nullable=False, server_default="10"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "last_activity_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="uq_rooms_code"),
        sa.CheckConstraint("code ~ '^[a-z0-9]{8,12}$'", name="ck_rooms_code_format"),
        sa.CheckConstraint("status IN ('active', 'closed')", name="ck_rooms_status"),
        sa.CheckConstraint("max_participants BETWEEN 2 AND 10", name="ck_rooms_max_participants"),
        sa.CheckConstraint(
            "(status = 'closed') = (closed_at IS NOT NULL)", name="ck_rooms_closed_at"
        ),
    )
    op.create_index("ix_rooms_status_last_activity", "rooms", ["status", "last_activity_at"])

    op.create_table(
        "participants",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("room_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("display_name", sa.String(length=32), nullable=False),
        sa.Column("role", sa.String(length=8), nullable=False, server_default="member"),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column(
            "joined_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
        ),
        sa.Column("connected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("disconnected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "last_seen_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("left_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["room_id"], ["rooms.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash", name="uq_participants_token_hash"),
        sa.CheckConstraint("role IN ('owner', 'member')", name="ck_participants_role"),
        sa.CheckConstraint(
            "char_length(btrim(display_name)) BETWEEN 1 AND 32", name="ck_participants_display_name"
        ),
        sa.CheckConstraint("token_hash ~ '^[0-9a-f]{64}$'", name="ck_participants_token_hash"),
    )
    op.create_index("ix_participants_room_id", "participants", ["room_id"])
    op.execute(
        "CREATE UNIQUE INDEX uq_participants_room_display_name "
        "ON participants (room_id, lower(display_name)) WHERE left_at IS NULL"
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_participants_room_owner "
        "ON participants (room_id) WHERE role = 'owner'"
    )

    op.create_table(
        "playback_states",
        sa.Column("room_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("video_id", sa.String(length=11), nullable=True),
        sa.Column("is_playing", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("position_seconds", sa.Double(), nullable=False, server_default="0"),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("updated_by_participant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["room_id"], ["rooms.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["updated_by_participant_id"], ["participants.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("room_id"),
        sa.CheckConstraint(
            "video_id IS NULL OR video_id ~ '^[A-Za-z0-9_-]{11}$'", name="ck_playback_video_id"
        ),
        sa.CheckConstraint(
            "position_seconds >= 0 AND position_seconds <= 86400", name="ck_playback_position"
        ),
        sa.CheckConstraint("revision >= 0", name="ck_playback_revision"),
        sa.CheckConstraint(
            "video_id IS NOT NULL OR (is_playing = false AND position_seconds = 0)",
            name="ck_playback_without_video",
        ),
    )
    op.create_index("ix_playback_updated_by", "playback_states", ["updated_by_participant_id"])

    op.create_table(
        "messages",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("room_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("participant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("text", sa.String(length=500), nullable=False),
        sa.Column("client_message_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["room_id"], ["rooms.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["participant_id"], ["participants.id"], ondelete="CASCADE"),
        sa.CheckConstraint("char_length(btrim(text)) BETWEEN 1 AND 500", name="ck_messages_text"),
    )
    op.create_index("ix_messages_room_id_id", "messages", ["room_id", "id"])
    op.execute(
        "CREATE UNIQUE INDEX uq_messages_participant_client_id "
        "ON messages (participant_id, client_message_id) "
        "WHERE client_message_id IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_table("messages")
    op.drop_table("playback_states")
    op.drop_table("participants")
    op.drop_table("rooms")
