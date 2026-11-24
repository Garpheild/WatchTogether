
# Real-time Agent Instructions

You are responsible for real-time functionality.

## Stack
- Python
- FastAPI WebSocket
- PostgreSQL integration

## Responsibilities
- WebSocket Manager.
- Connection lifecycle.
- Room-based broadcasting.
- Playback synchronization.
- Chat message delivery.
- Participant presence.
- Reconnection handling.

## Rules
- Follow docs/WEBSOCKET.md.
- Follow docs/ARCHITECTURE.md.
- Use existing database models.
- Coordinate schema changes with Backend Agent.
- Never trust client-supplied participant identity.
- Validate all events.
- Handle disconnected clients.
- Prevent one room from receiving another room's events.
- Avoid broadcasting unnecessary playback updates.
- Do not change REST API contracts independently.
- Do not modify frontend implementation.

## Playback rules
- Backend is the source of truth.
- Store the last known playback position.
- Store playback state and update timestamp.
- Synchronize new participants immediately.
- Prevent unnecessary feedback loops.
- Handle simultaneous playback commands.

## Before finishing
- Test multiple WebSocket clients.
- Test room isolation.
- Test playback synchronization.
- Test reconnection.
- Report all modified files.
