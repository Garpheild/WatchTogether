# Changelog

All notable changes to the Watch Party frontend are documented here.

## [Unreleased] - 2026-11-26

### Added

- Complete React 19 + TypeScript + Vite + Tailwind CSS frontend for Watch Party.
- Responsive application shell, routing, home page, room page and not-found page.
- Room creation, joining by room code or invite link, leaving a room and
  owner-only room closing.
- Guest join flow with per-room token and username persistence in localStorage.
- Typed REST API client for rooms, participants, messages, playback state and
  short-lived WebSocket tickets.
- WebSocket client with ticket authentication, heartbeat, exponential reconnect
  backoff with jitter, offline/online and visibility handling.
- Room realtime state management for snapshots, playback events, presence,
  chat messages and room-closed events.
- YouTube IFrame Player API integration behind a reusable `PlayerAdapter`.
- Playback synchronization with server revisions, drift detection, seek
  detection, watchdog correction and autoplay-blocked recovery.
- Owner video selection and playback controls for all participants.
- Chat with optimistic sending, pending/failed states, deduplication by
  `client_message_id`, history pagination and automatic scrolling.
- Participants panel with online/offline presence.
- Connection banners, loading states, error states, retry actions and
  room-closed handling.
- Toast notifications and accessible dialogs.
- Vitest tests for YouTube URL parsing, room-code normalization, playback
  synchronization and WebSocket lifecycle/close codes.
- Frontend environment example with API and WebSocket defaults for
  `localhost:8000`.
- ESLint, Prettier, TypeScript project references and Yarn 4 configuration.

### Changed

- Normalized HTTP API/WebSocket URLs so `http://` and `https://` values produce
  valid `ws://` and `wss://` endpoints.
- Improved YouTube loading by using `cueVideoById` so paused videos do not
  autoplay unexpectedly.
- Added a visible error overlay when the YouTube IFrame API cannot be loaded.
- Cleared stale session and refresh errors, and surfaced close/leave failures
  as toast notifications.
- Ignored Yarn internal files while keeping configuration in the repository.

### Verification

Executed in `frontend/`:

- `corepack yarn typecheck` - passed
- `corepack yarn lint` - passed
- `corepack yarn test` - 4 test files, 29 tests passed
- `corepack yarn build` - passed

### Notes

- The backend and its API/WebSocket contracts were not modified.
- No browser/E2E test against a live backend and the real YouTube API was run.
- The root `.env.example` uses port `8080`, while the frontend defaults to
  `http://localhost:8000/api/v1`; backend/frontend port alignment is still
  required for local full-stack development.
- The repository CI workflow currently runs Yarn from the repository root, but
  the frontend package is located in `frontend/`. CI needs a `working-directory`
  update before the frontend checks can pass in GitHub Actions.
