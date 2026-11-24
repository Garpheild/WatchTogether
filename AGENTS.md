
# AGENTS.md — Watch Party

## 1. Project Overview

Watch Party is a web application for synchronized YouTube
video watching.

Users can create rooms, invite other people using a link,
watch YouTube videos together and communicate through
a real-time chat.

Authentication is guest-based. Users do not need accounts.

Main features:
- Create and close rooms.
- Join rooms using an invitation link.
- Guest usernames.
- Synchronized YouTube playback.
- Real-time chat.
- Online participants list.
- Reconnection after connection loss.

## 2. Technology Stack

### Frontend
- React
- TypeScript
- Tailwind CSS
- React Router
- YouTube IFrame Player API

### Backend
- Python
- FastAPI
- SQLAlchemy
- Alembic
- PostgreSQL
- WebSocket

### Infrastructure
- Docker
- Docker Compose
- Git
- GitHub

Do not introduce new frameworks or major dependencies
without discussing them with the team.

## 3. Architecture

The application uses a modular monolith architecture.

Frontend communicates with backend using:

1. REST API for room management and data retrieval.
2. WebSocket for real-time communication.

Backend is responsible for:
- Business logic.
- Room management.
- Guest identification.
- Database operations.
- Playback state management.
- WebSocket communication.

PostgreSQL stores:
- Rooms.
- Participants.
- Chat messages.

WebSocket connections are managed in memory.

The backend is the source of truth for shared room state.

YouTube videos are played directly in users' browsers.
The backend does not transmit video files.

## 4. Project Structure

frontend/
  src/
    components/
    pages/
    hooks/
    services/
    types/

backend/
  app/
    api/
    models/
    schemas/
    services/
    database/
    websocket/
    realtime/

docs/
  ARCHITECTURE.md
  DATABASE.md
  API.md
  WEBSOCKET.md
  DEVELOPMENT.md

## 5. General Development Rules

1. Before writing code, inspect the existing project structure.
2. Read this AGENTS.md and all applicable nested AGENTS.md files.
3. Read relevant documentation in the docs/ directory.
4. Follow the existing architecture and coding conventions.
5. Do not rewrite existing working code without a reason.
6. Do not modify files outside your assigned responsibility
   unless explicitly requested.
7. Do not introduce unnecessary abstractions.
8. Write readable, maintainable and simple code.
9. Use meaningful variable, function and class names.
10. Add comments only when they clarify non-obvious logic.
11. Do not duplicate existing functionality.
12. Never commit secrets, tokens or passwords.
13. Do not modify API or database contracts without
    updating the corresponding documentation.
14. Never claim that tests passed unless they were executed.

## 6. Team Responsibilities

### Agent 1 — Frontend Developer

Responsible for:
- React application.
- TypeScript components.
- Pages and routing.
- UI and responsive design.
- YouTube Player integration.
- REST API integration.
- WebSocket client integration.
- Chat interface.
- Participants interface.

Main directory:
frontend/

Do not independently modify backend implementation.

### Agent 2 — Backend Developer

Responsible for:
- FastAPI application.
- REST API.
- PostgreSQL.
- SQLAlchemy models.
- Alembic migrations.
- Room management.
- Guest token management.
- Database services.
- Chat message persistence.
- Input validation.

Main directories:
backend/app/api/
backend/app/models/
backend/app/schemas/
backend/app/services/
backend/app/database/

Coordinate all database and API changes with Agent 3
when they affect WebSocket functionality.

### Agent 3 — Real-time Developer

Responsible for:
- WebSocket connections.
- WebSocket Manager.
- Playback synchronization.
- Real-time chat delivery.
- Participant connection status.
- Reconnection logic.
- Playback state synchronization.
- Docker Compose and integration testing.

Main directories:
backend/app/websocket/
backend/app/realtime/

Coordinate database access with Agent 2.
Coordinate WebSocket events with Agent 1.

## 7. API Contract Rules

The API specification in docs/API.md is the
single source of truth for REST endpoints.

Do not invent new endpoint names or change existing
request and response formats without team approval.

All API changes must be documented.

## 8. WebSocket Contract Rules

The WebSocket specification in docs/WEBSOCKET.md
is the single source of truth for WebSocket events.

Every event must have:
- Event name.
- Payload structure.
- Expected behavior.
- Validation rules.
- Error handling.

Do not independently invent event names or payloads.

## 9. Database Rules

The database schema in docs/DATABASE.md is the
single source of truth.

Main tables:
- rooms
- participants
- messages

Rules:
- Use UUID primary keys.
- Use foreign keys.
- Use SQLAlchemy for database access.
- Use Alembic for schema migrations.
- Do not modify database schema manually.
- Never delete or reset existing data without approval.
- Coordinate schema changes with the backend team.

## 10. Playback Synchronization Rules

The backend is the source of truth.

Shared playback state includes:
- youtube_video_id
- is_playing
- current_time
- updated_at

Playback actions:
- play
- pause
- seek
- change_video

Only room owners can change the video.

All participants can control playback.

When a participant joins a room, they must receive
the current playback state.

Do not continuously broadcast playback position
every second.

Use timestamps to calculate the current position
and correct meaningful playback differences.

## 11. Security Rules

- Never trust participant IDs supplied by clients.
- Validate guest tokens on protected operations.
- Store token hashes, not raw tokens, in the database.
- Never expose owner tokens to other participants.
- Only owners can change the video or close rooms.
- Validate all incoming WebSocket messages.
- Limit message length.
- Validate YouTube video IDs.
- Do not store secrets in source code.
- Do not put permanent authentication tokens in URLs.

## 12. Testing Rules

Before completing a task:

Frontend:
- Run TypeScript checks.
- Run available lint commands.
- Test affected components.

Backend:
- Run relevant pytest tests.
- Check API behavior.
- Check database operations.
- Check authorization.

Real-time:
- Test WebSocket connections.
- Test multiple users in one room.
- Test playback synchronization.
- Test chat delivery.
- Test reconnection.

Do not mark unfinished tests as successful.

## 13. Git Rules

- main contains stable code.
- develop contains integrated development code.
- Each task must use a separate feature branch.
- Never commit directly to main.
- Never force push shared branches.
- Use Pull Requests for integration.
- Do not merge your own changes without review
  from a human team member.

Branch naming:
feature/frontend-*
feature/backend-*
feature/websocket-*
fix/*
docs/*

Commit message examples:
feat: add room creation
feat: implement guest joining
feat: synchronize playback
fix: handle websocket disconnect
docs: update api specification

## 14. Working Process

For every task:

1. Read project instructions.
2. Inspect relevant files.
3. Understand existing implementation.
4. Identify files that need modification.
5. Check whether another agent owns those files.
6. Propose a short implementation plan.
7. Implement only the assigned task.
8. Run relevant tests.
9. Update documentation if contracts changed.
10. Summarize changes and remaining issues.

If requirements are unclear, ask before making
architectural decisions.

If a task requires changes outside your responsibility,
explain why and request coordination.

## 15. Final Response Format

After completing a task, provide:

### Implemented
List of completed changes.

### Modified Files
List of changed files.

### Tests
Commands executed and their results.

### Integration Notes
Changes that other agents need to know about.

### Remaining Issues
Known bugs, limitations or unfinished work.

## 16. Priority Rules

Priority order:

1. Correctness.
2. Compatibility with existing contracts.
3. Security.
4. Maintainability.
5. Simplicity.
6. Performance.

Do not sacrifice correctness or architecture
for unnecessary abstractions or premature optimization.
