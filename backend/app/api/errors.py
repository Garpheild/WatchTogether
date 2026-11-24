from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.errors import AppError, RateLimited, ValidationError


def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    headers = {"Retry-After": str(exc.retry_after)} if isinstance(exc, RateLimited) else None
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message, "details": exc.details}},
        headers=headers,
    )


def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    fields = []
    for error in exc.errors():
        field = ".".join(str(part) for part in error["loc"][1:])
        fields.append({"field": field, "reason": error["msg"]})
    error = ValidationError({"fields": fields})
    return JSONResponse(
        status_code=422,
        content={"error": {"code": error.code, "message": error.message, "details": error.details}},
    )
