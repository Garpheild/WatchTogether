const TOKEN_PREFIX = 'watchparty:token:';
const NAME_PREFIX = 'watchparty:name:';

function storageKey(prefix: string, roomCode: string): string {
  return `${prefix}${roomCode.toLowerCase()}`;
}

export function getAccessToken(roomCode: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(TOKEN_PREFIX, roomCode));
  } catch {
    return null;
  }
}

export function setAccessToken(roomCode: string, token: string): void {
  try {
    window.localStorage.setItem(storageKey(TOKEN_PREFIX, roomCode), token);
  } catch {
    // Storage can be unavailable in private mode; the session still works in memory.
  }
}

export function clearAccessToken(roomCode: string): void {
  try {
    window.localStorage.removeItem(storageKey(TOKEN_PREFIX, roomCode));
  } catch {
    // Ignore storage errors.
  }
}

export function getDisplayName(roomCode: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(NAME_PREFIX, roomCode));
  } catch {
    return null;
  }
}

export function setDisplayName(roomCode: string, displayName: string): void {
  try {
    window.localStorage.setItem(storageKey(NAME_PREFIX, roomCode), displayName);
  } catch {
    // Ignore storage errors.
  }
}
