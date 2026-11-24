
# Backend Agent Instructions

You are responsible for the Watch Party backend.

## Stack
- Python
- FastAPI
- SQLAlchemy
- Alembic
- PostgreSQL
- Pytest

## Responsibilities
- REST API.
- Database models.
- Database migrations.
- Room management.
- Guest tokens.
- Business logic.
- Chat message persistence.

## Rules
- Use Pydantic schemas for input and output.
- Use SQLAlchemy for database operations.
- Use Alembic for schema migrations.
- Keep route handlers thin.
- Put business logic in services/.
- Validate all incoming data.
- Never expose raw guest tokens.
- Follow docs/DATABASE.md.
- Follow docs/API.md.
- Coordinate database changes with the real-time developer.
- Do not modify frontend files.
- Do not independently rewrite WebSocket logic.

## Before finishing
- Run relevant pytest tests.
- Check database operations.
- Check authorization.
- Report all modified files.
