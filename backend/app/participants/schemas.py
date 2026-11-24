import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class ParticipantResponse(BaseModel):
    participant_id: uuid.UUID
    display_name: str
    role: Literal["owner", "member"]
    is_online: bool
    joined_at: datetime


class Principal(BaseModel):
    participant_id: uuid.UUID
    room_code: str
    role: Literal["owner", "member"]
