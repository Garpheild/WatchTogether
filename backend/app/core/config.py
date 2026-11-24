from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    app_secret_key: str = Field(default="development-secret-key-32bytes!!")
    database_url: str = (
        "postgresql+asyncpg://watchtogether:watchtogether@localhost:5432/watchtogether"
    )
    test_database_url: str = (
        "postgresql+asyncpg://watchtogether:watchtogether@localhost:5432/watchtogether_test"
    )
    cors_origins: str = "http://localhost:5173"
    room_max_participants: int = 10
    ws_ticket_ttl_seconds: int = 60
    presence_grace_seconds: int = 15
    ws_heartbeat_interval_seconds: int = 25
    ws_heartbeat_timeout_seconds: int = 10
    playback_position_tolerance_seconds: float = 3.0
    trust_proxy_headers: bool = False
    log_level: str = "INFO"

    @field_validator("app_secret_key")
    @classmethod
    def validate_secret(cls, value: str) -> str:
        if len(value.encode()) < 32:
            raise ValueError("APP_SECRET_KEY must be at least 32 bytes")
        return value

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
