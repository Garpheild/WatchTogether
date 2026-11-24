from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.chat.repository import ChatRepository
from app.chat.schemas import MessageResponse
from app.core.db import get_db
from app.participants.service import resolve_principal

router = APIRouter(tags=["messages"])
SessionDep = Annotated[AsyncSession, Depends(get_db)]


@router.get("/rooms/{room_code}/messages")
async def history(
    room_code: str,
    session: SessionDep,
    limit: int = Query(default=50, ge=1, le=100),
    before_id: int | None = Query(default=None, ge=1),
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    token = (
        authorization[7:].strip() if authorization and authorization.startswith("Bearer ") else None
    )
    room, _participant = await resolve_principal(session, token, room_code)
    rows = await ChatRepository(session).history(room.id, limit, before_id)
    has_more = len(rows) > limit
    page = rows[:limit]
    messages = [
        MessageResponse(
            message_id=message.id,
            room_code=room_code,
            participant_id=message.participant_id,
            display_name=participant.display_name,
            text=message.text,
            created_at=message.created_at,
            client_message_id=message.client_message_id,
        )
        for message, participant in reversed(page)
    ]
    return {"messages": messages, "has_more": has_more}
