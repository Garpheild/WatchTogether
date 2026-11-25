import uuid
from datetime import UTC, datetime
from typing import Any

from app.realtime.manager import Connection, ConnectionManager


class FakeSocket:
    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []
        self.closed: list[int] = []

    async def send_json(self, data: Any) -> None:
        self.sent.append(data)

    async def close(self, code: int = 1000, reason: str | None = None) -> None:
        self.closed.append(code)


def make_connection(room_code: str, participant_id: uuid.UUID) -> tuple[Connection, FakeSocket]:
    socket = FakeSocket()
    connection = Connection(
        websocket=socket,
        room_code=room_code,
        participant_id=participant_id,
        role="member",
        connected_at=datetime.now(UTC),
    )
    return connection, socket


async def test_presence_transitions_and_grace() -> None:
    manager = ConnectionManager()
    room_code = "room1"
    participant_id = uuid.uuid4()
    first, _ = make_connection(room_code, participant_id)
    second, _ = make_connection(room_code, participant_id)

    assert await manager.register(first) is True
    assert await manager.register(second) is False
    assert await manager.unregister(first) is False
    assert await manager.unregister(second) is True
    # The participant stays online during the grace period.
    assert await manager.online_participant_ids(room_code) == {participant_id}
    assert await manager.finalize_disconnect(room_code, participant_id) is True
    assert await manager.online_participant_ids(room_code) == set()


async def test_room_isolation() -> None:
    manager = ConnectionManager()
    first, first_socket = make_connection("room1", uuid.uuid4())
    second, second_socket = make_connection("room2", uuid.uuid4())
    await manager.register(first)
    await manager.register(second)

    await manager.broadcast("room1", {"type": "ping"})
    assert first_socket.sent == [{"type": "ping"}]
    assert second_socket.sent == []


async def test_close_participant_removes_presence() -> None:
    manager = ConnectionManager()
    room_code = "room1"
    participant_id = uuid.uuid4()
    connection, socket = make_connection(room_code, participant_id)
    await manager.register(connection)

    await manager.close_participant(room_code, participant_id, 4403)
    assert socket.closed == [4403]
    assert await manager.online_participant_ids(room_code) == set()
