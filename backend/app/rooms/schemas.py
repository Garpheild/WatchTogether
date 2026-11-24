from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


def control_chars(value: str) -> str:
    if any(ord(char) < 32 and char not in "\n\t" for char in value):
        raise ValueError("control characters are not allowed")
    return value


class CreateRoomRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: str = Field(min_length=1, max_length=32)
    title: str | None = Field(default=None, max_length=80)
    video_url: str | None = None

    @field_validator("display_name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()
        control_chars(value)
        if not 1 <= len(value) <= 32:
            raise ValueError("must be 1..32 characters after trim")
        return value

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        control_chars(value)
        if len(value) > 80:
            raise ValueError("must be at most 80 characters")
        return value or None


class JoinRoomRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: str = Field(min_length=1, max_length=32)

    @field_validator("display_name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()
        control_chars(value)
        if not 1 <= len(value) <= 32:
            raise ValueError("must be 1..32 characters after trim")
        return value


class RoomResponse(BaseModel):
    room_code: str
    title: str | None
    status: Literal["active", "closed"]
    max_participants: int
    created_at: datetime
    closed_at: datetime | None
