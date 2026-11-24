
# Frontend Agent Instructions

You are responsible for the Watch Party frontend.

## Stack
- React
- TypeScript
- Tailwind CSS
- React Router

## Responsibilities
- Pages and components.
- Room interface.
- Guest joining.
- YouTube Player API.
- Chat interface.
- Participants list.
- REST API integration.
- WebSocket client.

## Rules
- Use TypeScript for all new components.
- Keep components small and reusable.
- Keep API requests in services/.
- Keep WebSocket logic in services/websocket.ts.
- Do not put business logic directly into UI components.
- Use shared types for API and WebSocket payloads.
- Do not invent API endpoints.
- Do not invent WebSocket event formats.
- Follow docs/API.md and docs/WEBSOCKET.md.
- Handle loading, error and disconnected states.
- Do not modify backend files.

## Before finishing
- Run TypeScript checks.
- Run available frontend tests.
- Report all modified files.
