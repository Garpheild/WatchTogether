const ROOM_CODE_PATTERN = /^[a-z0-9]{4,32}$/;

export function normalizeRoomCode(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  let candidate = trimmed;
  if (candidate.includes('/')) {
    try {
      const url = new URL(candidate, window.location.origin);
      const segments = url.pathname.split('/').filter(Boolean);
      const roomIndex = segments.indexOf('r');
      candidate = roomIndex >= 0 ? (segments[roomIndex + 1] ?? '') : (segments.at(-1) ?? '');
    } catch {
      return null;
    }
  }

  const normalized = candidate.trim().toLowerCase();
  return ROOM_CODE_PATTERN.test(normalized) ? normalized : null;
}
