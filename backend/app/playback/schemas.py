import uuid
from datetime import datetime

from pydantic import BaseModel


class PlaybackStateResponse(BaseModel):
    video_id: str | None
    video_url: str | None
    is_playing: bool
    position_seconds: float
    updated_at: datetime
    revision: int
    updated_by_participant_id: uuid.UUID | None
