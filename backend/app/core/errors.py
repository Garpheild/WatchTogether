from typing import Any


class AppError(Exception):
    code: str
    status_code: int
    message: str
    details: dict[str, Any] | None = None

    def __init__(
        self,
        code: str,
        status_code: int,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.status_code = status_code
        self.message = message
        self.details = details


class ValidationError(AppError):
    def __init__(self, details: dict[str, Any] | None = None) -> None:
        super().__init__("validation_error", 422, "Request validation failed", details)


class InvalidToken(AppError):
    def __init__(self) -> None:
        super().__init__("invalid_token", 401, "Access token is missing or invalid")


class Forbidden(AppError):
    def __init__(self, message: str = "Action is forbidden") -> None:
        super().__init__("forbidden", 403, message)


class RoomNotFound(AppError):
    def __init__(self) -> None:
        super().__init__("room_not_found", 404, "Room was not found")


class RoomClosed(AppError):
    def __init__(self) -> None:
        super().__init__("room_closed", 409, "Room is closed")


class RoomFull(AppError):
    def __init__(self, max_participants: int) -> None:
        super().__init__(
            "room_full",
            409,
            "Room has reached the maximum number of participants",
            {"max_participants": max_participants},
        )


class NameTaken(AppError):
    def __init__(self) -> None:
        super().__init__("name_taken", 409, "Display name is already taken")


class OwnerMustClose(AppError):
    def __init__(self) -> None:
        super().__init__("owner_must_close", 409, "The owner must close the room")


class RateLimited(AppError):
    def __init__(self, retry_after: int) -> None:
        super().__init__("rate_limited", 429, "Rate limit exceeded", {"retry_after": retry_after})
        self.retry_after = retry_after
