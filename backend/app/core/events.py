from typing import Protocol


class RoomEventPublisher(Protocol):
    async def participant_left(self, room_code: str, participant_id: str) -> None: ...

    async def room_closed(
        self,
        room_code: str,
        closed_at: str,
        closed_by_participant_id: str | None = None,
    ) -> None: ...
