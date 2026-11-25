from datetime import UTC, datetime, timedelta
from uuid import uuid4

from app.playback.models import PlaybackState
from app.playback.service import current_position


def make_state(
    *,
    is_playing: bool,
    position: float,
    updated_at: datetime,
) -> PlaybackState:
    return PlaybackState(
        room_id=uuid4(),
        video_id="dQw4w9WgXcQ",
        is_playing=is_playing,
        position_seconds=position,
        revision=0,
        updated_at=updated_at,
        updated_by_participant_id=None,
    )


def test_paused_position_does_not_move() -> None:
    now = datetime(2026, 11, 24, 18, 0, tzinfo=UTC)
    state = make_state(is_playing=False, position=42.0, updated_at=now)
    assert current_position(state, now + timedelta(seconds=30)) == 42.0


def test_playing_position_includes_elapsed_time() -> None:
    now = datetime(2026, 11, 24, 18, 0, tzinfo=UTC)
    state = make_state(is_playing=True, position=10.0, updated_at=now)
    assert current_position(state, now + timedelta(seconds=5)) == 15.0


def test_future_updated_at_does_not_subtract_time() -> None:
    now = datetime(2026, 11, 24, 18, 0, tzinfo=UTC)
    state = make_state(is_playing=True, position=10.0, updated_at=now)
    assert current_position(state, now - timedelta(seconds=5)) == 10.0


def test_position_is_clamped_to_room_limit() -> None:
    now = datetime(2026, 11, 24, 18, 0, tzinfo=UTC)
    state = make_state(is_playing=True, position=86399.0, updated_at=now)
    assert current_position(state, now + timedelta(seconds=10)) == 86400.0
