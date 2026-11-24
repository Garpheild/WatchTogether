import uuid
from datetime import datetime

from pydantic import BaseModel


class MessageResponse(BaseModel):
    message_id: int
    room_code: str
    participant_id: uuid.UUID
    display_name: str
    text: str
    created_at: datetime
    client_message_id: uuid.UUID | None
