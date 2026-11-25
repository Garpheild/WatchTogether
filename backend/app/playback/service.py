from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock
from app.core.errors import AppError, RoomClosed, ValidationError
from app.core.youtube import parse_youtube_url
from app.participants.models import Participant
from app.playback.models import PlaybackState
from app.playback.repository import PlaybackRepository
from app.rooms.models import Room

NOOP_POSITION_TOLERANCE_SECONDS = 0.25
MAX_POSITION_SECONDS = 86400.0


class VideoNotSet(AppError):
    def __init__(self) -> None:
        super().__init__("video_not_set", 409, "No video is selected for playback")


class StalePosition(AppError):
    def __init__(self, server_position: float) -> None:
        super().__init__(
            "stale_position",
            409,
            "Client position is too far from the current playback position",
            {"server_position_seconds": round(server_position, 3)},
        )


def current_position(state: PlaybackState, now: datetime) -> float:
    if not state.is_playing:
        return state.position_seconds
    elapsed = max(0.0, (now - state.updated_at).total_seconds())
    return min(MAX_POSITION_SECONDS, state.position_seconds + elapsed)


def _validate_position(position: float) -> float:
    if not 0 <= position <= MAX_POSITION_SECONDS:
        raise ValidationError(
            {"fields": [{"field": "position_seconds", "reason": "must be in 0..86400"}]}
        )
    return float(position)


async def _locked_state(session: AsyncSession, room: Room) -> PlaybackState:
    state = await PlaybackRepository(session).get_by_room_id_for_update(room.id)
    if state is None:
        raise RuntimeError("playback state is missing for the room")
    return state


async def handle_command(
    session: AsyncSession,
    clock: Clock,
    room: Room,
    participant: Participant,
    action: str,
    position_seconds: float,
    tolerance_seconds: float,
) -> tuple[PlaybackState, bool]:
    """Apply a play/pause/seek command. Returns (state, changed)."""
    if room.status != "active":
        raise RoomClosed()
    if action not in {"play", "pause", "seek"}:
        raise ValidationError(
            {"fields": [{"field": "action", "reason": "must be play, pause or seek"}]}
        )

    position = _validate_position(position_seconds)
    state = await _locked_state(session, room)
    if state.video_id is None:
        raise VideoNotSet()

    now = clock.now()
    server_position = current_position(state, now)
    if action in {"play", "pause"} and abs(position - server_position) > tolerance_seconds:
        raise StalePosition(server_position)

    is_playing = state.is_playing if action == "seek" else action == "play"
    unchanged = (
        state.is_playing == is_playing
        and abs(position - server_position) < NOOP_POSITION_TOLERANCE_SECONDS
    )
    if unchanged:
        return state, False

    state.position_seconds = position
    state.is_playing = is_playing
    state.updated_at = now
    state.updated_by_participant_id = participant.id
    state.revision += 1
    await session.flush()
    return state, True


async def change_video(
    session: AsyncSession,
    clock: Clock,
    room: Room,
    participant: Participant,
    video_url: str,
) -> PlaybackState:
    if room.status != "active":
        raise RoomClosed()
    video_id = parse_youtube_url(video_url)
    if video_id is None:
        raise ValidationError(
            {"fields": [{"field": "video_url", "reason": "unsupported YouTube URL"}]}
        )

    state = await _locked_state(session, room)
    state.video_id = video_id
    state.is_playing = False
    state.position_seconds = 0.0
    state.updated_at = clock.now()
    state.updated_by_participant_id = participant.id
    state.revision += 1
    await session.flush()
    return state
