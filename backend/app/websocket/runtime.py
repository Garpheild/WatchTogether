from app.realtime.manager import ConnectionManager
from app.websocket.handlers import RoomEventHandler
from app.websocket.presence import PresenceService
from app.websocket.publisher import RealtimeEventPublisher


class RealtimeRuntime:
    def __init__(self) -> None:
        self.manager = ConnectionManager()
        self.handler = RoomEventHandler(self.manager)
        self.presence = PresenceService(self.manager)
        self.publisher = RealtimeEventPublisher(self.manager)

    async def shutdown(self) -> None:
        await self.manager.shutdown()
