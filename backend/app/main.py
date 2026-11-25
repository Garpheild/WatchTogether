from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.api.errors import app_error_handler, validation_error_handler
from app.api.router import api_router
from app.core.config import get_settings
from app.core.errors import AppError
from app.websocket.endpoint import router as websocket_router
from app.websocket.runtime import RealtimeRuntime


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    yield
    runtime = getattr(app.state, "realtime", None)
    if isinstance(runtime, RealtimeRuntime):
        await runtime.shutdown()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="WatchTogether",
        version="1.0.0",
        docs_url="/docs" if settings.app_env != "production" else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.app_env != "production" else None,
        lifespan=lifespan,
    )
    runtime = RealtimeRuntime()
    app.state.realtime = runtime
    app.state.room_event_publisher = runtime.publisher
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )
    app.add_exception_handler(AppError, app_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(
        RequestValidationError,
        validation_error_handler,  # type: ignore[arg-type]
    )
    app.include_router(api_router)
    app.include_router(websocket_router, prefix="/api/v1")
    return app


app = create_app()
