from fastapi import APIRouter

from app.api.routes import health, messages, rooms

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(rooms.router)
api_router.include_router(messages.router)
