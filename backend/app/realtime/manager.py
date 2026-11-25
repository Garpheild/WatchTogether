import asyncio
import logging
import uuid
from collections import deque
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Protocol

from app.realtime.protocol import CLOSE_GOING_AWAY, CLOSE_POLICY_VIOLATION

logger = logging.getLogger(__name__)

SEND_TIMEOUT_SECONDS = 5.0
MAX_CONNECTIONS_PER_PARTICIPANT = 3
MAX_CONNECTIONS_PER_ROOM = 30


class WebSocketLike(Protocol):
    async def send_json(self, data: Any) -> None: ...

    async def close(self, code: int = 1000, reason: str | None = None) -> None: ...


class ConnectionLimitExceeded(Exception):
    pass


class RoomIsClosed(Exception):
    pass


@dataclass(eq=False)
class Connection:
    websocket: WebSocketLike
    room_code: str
    participant_id: uuid.UUID
    role: str
    connected_at: datetime
    send_lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    protocol_errors: deque[float] = field(default_factory=deque)
    rate_limit_hits: deque[float] = field(default_factory=deque)


class ConnectionManager:
    """In-memory registry of open sockets, room broadcasts and presence grace timers."""

    def __init__(self) -> None:
        self._rooms: dict[str, dict[uuid.UUID, set[Connection]]] = {}
        self._lock = asyncio.Lock()
        self._room_locks: dict[str, asyncio.Lock] = {}
        self._grace_tasks: dict[tuple[str, uuid.UUID], asyncio.Task[None]] = {}
        self._suppress_grace: set[tuple[str, uuid.UUID]] = set()
        self._closed_rooms: set[str] = set()

    async def can_connect(self, room_code: str, participant_id: uuid.UUID) -> bool:
        async with self._lock:
            if room_code in self._closed_rooms:
                return False
            participants = self._rooms.get(room_code, {})
            if sum(len(connections) for connections in participants.values()) >= (
                MAX_CONNECTIONS_PER_ROOM
            ):
                return False
            return len(participants.get(participant_id, set())) < (MAX_CONNECTIONS_PER_PARTICIPANT)

    async def register(self, connection: Connection) -> bool:
        """Register a socket. Returns True when the participant became online."""
        async with self._lock:
            if connection.room_code in self._closed_rooms:
                raise RoomIsClosed
            participants = self._rooms.setdefault(connection.room_code, {})
            room_connections = sum(len(connections) for connections in participants.values())
            if room_connections >= MAX_CONNECTIONS_PER_ROOM:
                raise ConnectionLimitExceeded
            participant_connections = participants.get(connection.participant_id, set())
            if len(participant_connections) >= MAX_CONNECTIONS_PER_PARTICIPANT:
                raise ConnectionLimitExceeded
            # An empty set means the participant is inside the presence grace period.
            became_online = connection.participant_id not in participants
            participants.setdefault(connection.participant_id, set()).add(connection)
            self._suppress_grace.discard((connection.room_code, connection.participant_id))
            self.cancel_grace(connection.room_code, connection.participant_id)
            return became_online

    async def unregister(self, connection: Connection) -> bool:
        """Remove a socket. Returns True when it was the participant's last one."""
        async with self._lock:
            participants = self._rooms.get(connection.room_code)
            if participants is None:
                return False
            connections = participants.get(connection.participant_id)
            if connections is None:
                return False
            connections.discard(connection)
            if connections:
                return False
            if (
                connection.room_code in self._closed_rooms
                or (connection.room_code, connection.participant_id) in self._suppress_grace
            ):
                participants.pop(connection.participant_id, None)
                if not participants:
                    self._rooms.pop(connection.room_code, None)
            # Otherwise keep the empty set: the participant is online until grace expires.
            return True

    async def finalize_disconnect(self, room_code: str, participant_id: uuid.UUID) -> bool:
        """Remove a grace-period participant. Returns False if they reconnected."""
        async with self._lock:
            participants = self._rooms.get(room_code)
            if participants is None:
                return False
            connections = participants.get(participant_id)
            if connections:
                return False
            participants.pop(participant_id, None)
            if not participants:
                self._rooms.pop(room_code, None)
            return True

    async def online_participant_ids(self, room_code: str) -> set[uuid.UUID]:
        async with self._lock:
            return set(self._rooms.get(room_code, {}))

    async def has_connections(self, room_code: str, participant_id: uuid.UUID) -> bool:
        async with self._lock:
            return bool(self._rooms.get(room_code, {}).get(participant_id))

    async def connection_count(self, room_code: str) -> int:
        async with self._lock:
            return sum(len(connections) for connections in self._rooms.get(room_code, {}).values())

    def is_room_closed(self, room_code: str) -> bool:
        return room_code in self._closed_rooms

    def room_lock(self, room_code: str) -> asyncio.Lock:
        lock = self._room_locks.get(room_code)
        if lock is None:
            lock = asyncio.Lock()
            self._room_locks[room_code] = lock
        return lock

    async def send(self, connection: Connection, message: dict[str, Any]) -> bool:
        try:
            async with connection.send_lock:
                await asyncio.wait_for(
                    connection.websocket.send_json(message),
                    timeout=SEND_TIMEOUT_SECONDS,
                )
            return True
        except Exception:
            logger.debug("Dropping stale websocket for %s", connection.participant_id)
            await self._close_socket(connection, CLOSE_GOING_AWAY)
            return False

    async def send_to(self, connection: Connection, message: dict[str, Any]) -> bool:
        return await self.send(connection, message)

    async def broadcast(
        self,
        room_code: str,
        message: dict[str, Any],
        *,
        exclude: Connection | None = None,
        exclude_participant: uuid.UUID | None = None,
    ) -> None:
        async with self._lock:
            connections = [
                connection
                for participant_connections in self._rooms.get(room_code, {}).values()
                for connection in participant_connections
                if connection is not exclude
                and (
                    exclude_participant is None or connection.participant_id != exclude_participant
                )
            ]
        if not connections:
            return
        await asyncio.gather(
            *(self.send(connection, message) for connection in connections),
            return_exceptions=True,
        )

    async def send_to_participant(
        self,
        room_code: str,
        participant_id: uuid.UUID,
        message: dict[str, Any],
    ) -> None:
        async with self._lock:
            connections = list(self._rooms.get(room_code, {}).get(participant_id, set()))
        if not connections:
            return
        await asyncio.gather(
            *(self.send(connection, message) for connection in connections),
            return_exceptions=True,
        )

    def schedule_grace(
        self,
        room_code: str,
        participant_id: uuid.UUID,
        delay_seconds: float,
        callback: Callable[[str, uuid.UUID], Awaitable[None]],
    ) -> None:
        if room_code in self._closed_rooms:
            return
        if (room_code, participant_id) in self._suppress_grace:
            return
        key = (room_code, participant_id)
        self.cancel_grace(room_code, participant_id)

        async def runner() -> None:
            try:
                await asyncio.sleep(delay_seconds)
            except asyncio.CancelledError:
                return
            try:
                await callback(room_code, participant_id)
            except Exception:
                logger.exception(
                    "Presence grace callback failed for %s/%s", room_code, participant_id
                )
            finally:
                self._grace_tasks.pop(key, None)

        self._grace_tasks[key] = asyncio.create_task(runner())

    def cancel_grace(self, room_code: str, participant_id: uuid.UUID) -> None:
        task = self._grace_tasks.pop((room_code, participant_id), None)
        if task is not None and not task.done():
            task.cancel()

    def mark_participant_left(self, room_code: str, participant_id: uuid.UUID) -> None:
        self._suppress_grace.add((room_code, participant_id))
        self.cancel_grace(room_code, participant_id)

    def mark_room_closed(self, room_code: str) -> None:
        self._closed_rooms.add(room_code)
        for key in [key for key in self._grace_tasks if key[0] == room_code]:
            self.cancel_grace(*key)
        for key in [key for key in self._suppress_grace if key[0] == room_code]:
            self._suppress_grace.discard(key)

    async def close_participant(
        self,
        room_code: str,
        participant_id: uuid.UUID,
        code: int = CLOSE_POLICY_VIOLATION,
    ) -> None:
        self.mark_participant_left(room_code, participant_id)
        async with self._lock:
            connections = list(self._rooms.get(room_code, {}).get(participant_id, set()))
        await asyncio.gather(
            *(self._close_socket(connection, code) for connection in connections),
            return_exceptions=True,
        )
        async with self._lock:
            participants = self._rooms.get(room_code)
            if participants is not None:
                participants.pop(participant_id, None)
                if not participants:
                    self._rooms.pop(room_code, None)

    async def close_room(self, room_code: str, code: int) -> None:
        self.mark_room_closed(room_code)
        async with self._lock:
            connections = [
                connection
                for participant_connections in self._rooms.get(room_code, {}).values()
                for connection in participant_connections
            ]
        await asyncio.gather(
            *(self._close_socket(connection, code) for connection in connections),
            return_exceptions=True,
        )
        async with self._lock:
            self._rooms.pop(room_code, None)

    async def shutdown(self) -> None:
        for key in list(self._grace_tasks):
            self.cancel_grace(*key)
        async with self._lock:
            connections = [
                connection
                for participants in self._rooms.values()
                for participant_connections in participants.values()
                for connection in participant_connections
            ]
        await asyncio.gather(
            *(self._close_socket(connection, CLOSE_GOING_AWAY) for connection in connections),
            return_exceptions=True,
        )

    async def _close_socket(self, connection: Connection, code: int) -> None:
        try:
            await asyncio.wait_for(
                connection.websocket.close(code=code),
                timeout=SEND_TIMEOUT_SECONDS,
            )
        except Exception:
            pass
