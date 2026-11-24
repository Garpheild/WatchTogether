from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import SystemClock
from app.core.config import get_settings
from app.core.db import get_db
from app.core.errors import (
    Forbidden,
    NameTaken,
    OwnerMustClose,
    RoomClosed,
    RoomFull,
    RoomNotFound,
)
from app.core.rate_limit import TokenBucket
from app.core.security import create_ws_ticket, generate_access_token, hash_access_token
from app.core.youtube import canonical_youtube_url, parse_youtube_url
from app.participants.models import Participant
from app.participants.repository import ParticipantRepository
from app.participants.schemas import ParticipantResponse
from app.participants.service import resolve_principal
from app.playback.models import PlaybackState
from app.playback.schemas import PlaybackStateResponse
from app.rooms.models import Room
from app.rooms.repository import RoomRepository
from app.rooms.schemas import CreateRoomRequest, JoinRoomRequest, RoomResponse
from app.use_cases.create_room import create_room

router = APIRouter(prefix="/rooms", tags=["rooms"])
SessionDep = Annotated[AsyncSession, Depends(get_db)]
create_limit = TokenBucket(rate=1 / 3600, burst=5)
join_limit = TokenBucket(rate=1 / 60, burst=10)
ticket_participant_limit = TokenBucket(rate=1 / 60, burst=10)
ticket_ip_limit = TokenBucket(rate=1 / 120, burst=30)


def room_response(room: Room) -> RoomResponse:
    return RoomResponse(
        room_code=room.code,
        title=room.title,
        status=room.status,
        max_participants=room.max_participants,
        created_at=room.created_at,
        closed_at=room.closed_at,
    )


def playback_response(playback: PlaybackState) -> PlaybackStateResponse:
    return PlaybackStateResponse(
        video_id=playback.video_id,
        video_url=canonical_youtube_url(playback.video_id),
        is_playing=playback.is_playing,
        position_seconds=playback.position_seconds,
        updated_at=playback.updated_at,
        revision=playback.revision,
        updated_by_participant_id=playback.updated_by_participant_id,
    )


async def participants_response(session: AsyncSession, room: Room) -> list[ParticipantResponse]:
    participants = await ParticipantRepository(session).list_active(room.id)
    return [
        ParticipantResponse(
            participant_id=participant.id,
            display_name=participant.display_name,
            role=participant.role,
            is_online=False,
            joined_at=participant.joined_at,
        )
        for participant in participants
    ]


@router.post("", status_code=201)
async def create(
    request: CreateRoomRequest,
    http_request: Request,
    session: SessionDep,
) -> dict[str, object]:
    create_limit.require(f"{http_request.client.host if http_request.client else 'unknown'}")
    video_id = parse_youtube_url(request.video_url)
    if request.video_url not in (None, "") and video_id is None:
        from app.core.errors import ValidationError

        raise ValidationError(
            {"fields": [{"field": "video_url", "reason": "unsupported YouTube URL"}]}
        )

    settings = get_settings()
    async with session.begin():
        room, participant, playback, token = await create_room(
            session,
            SystemClock(),
            request.display_name,
            request.title,
            video_id,
            settings.room_max_participants,
        )
    return {
        "room": room_response(room),
        "playback": playback_response(playback),
        "participants": await participants_response(session, room),
        "you": {"participant_id": participant.id, "role": "owner"},
        "access_token": token,
    }


@router.post("/{room_code}/join", status_code=201)
async def join(
    room_code: str,
    request: JoinRoomRequest,
    http_request: Request,
    session: SessionDep,
) -> dict[str, object]:
    join_limit.require(f"{http_request.client.host if http_request.client else 'unknown'}")

    async with session.begin():
        room_repo = RoomRepository(session)
        room = await room_repo.get_by_code_for_update(room_code)
        if room is None:
            raise RoomNotFound()
        if room.status != "active":
            raise RoomClosed()
        participant_repo = ParticipantRepository(session)
        if await participant_repo.count_active(room.id) >= room.max_participants:
            raise RoomFull(room.max_participants)
        if await participant_repo.name_exists(room.id, request.display_name):
            raise NameTaken()

        token = generate_access_token()
        now = SystemClock().now()
        participant = Participant(
            room_id=room.id,
            display_name=request.display_name,
            role="member",
            token_hash=hash_access_token(token),
            joined_at=now,
            last_seen_at=now,
            left_at=None,
        )
        try:
            await participant_repo.add(participant)
        except IntegrityError:
            raise NameTaken() from None
        playback = (
            await session.execute(select(PlaybackState).where(PlaybackState.room_id == room.id))
        ).scalar_one()

    return {
        "room": room_response(room),
        "playback": playback_response(playback),
        "participants": await participants_response(session, room),
        "you": {"participant_id": participant.id, "role": "member"},
        "access_token": token,
    }


@router.get("/{room_code}")
async def get_room(
    room_code: str,
    session: SessionDep,
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    token = (
        authorization[7:].strip() if authorization and authorization.startswith("Bearer ") else None
    )
    room, participant = await resolve_principal(session, token, room_code)
    playback = (
        await session.execute(select(PlaybackState).where(PlaybackState.room_id == room.id))
    ).scalar_one()
    return {
        "room": room_response(room),
        "playback": playback_response(playback),
        "participants": await participants_response(session, room),
        "you": {"participant_id": participant.id, "role": participant.role},
    }


@router.post("/{room_code}/ws-ticket")
async def ws_ticket(
    room_code: str,
    http_request: Request,
    session: SessionDep,
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    token = (
        authorization[7:].strip() if authorization and authorization.startswith("Bearer ") else None
    )
    room, participant = await resolve_principal(session, token, room_code)
    if room.status != "active":
        raise RoomClosed()
    ip = http_request.client.host if http_request.client else "unknown"
    ticket_ip_limit.require(ip)
    ticket_participant_limit.require(str(participant.id))
    ticket, expires_at = create_ws_ticket(participant.id, room_code)
    return {"ticket": ticket, "expires_at": expires_at}


@router.post("/{room_code}/leave", status_code=204)
async def leave(
    room_code: str,
    session: SessionDep,
    authorization: str | None = Header(default=None),
) -> Response:
    token = (
        authorization[7:].strip() if authorization and authorization.startswith("Bearer ") else None
    )
    room, participant = await resolve_principal(session, token, room_code)
    if participant.role == "owner":
        raise OwnerMustClose()
    async with session.begin():
        await ParticipantRepository(session).leave(participant, SystemClock().now())
    return Response(status_code=204)


@router.delete("/{room_code}", status_code=204)
async def close_room(
    room_code: str,
    session: SessionDep,
    authorization: str | None = Header(default=None),
) -> Response:
    token = (
        authorization[7:].strip() if authorization and authorization.startswith("Bearer ") else None
    )
    room, participant = await resolve_principal(session, token, room_code)
    if participant.role != "owner":
        raise Forbidden("Only the owner can close the room")
    async with session.begin():
        await RoomRepository(session).close(room, SystemClock().now())
    return Response(status_code=204)
