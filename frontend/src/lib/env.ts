const DEFAULT_API_URL = 'http://localhost:8000/api/v1';

function resolveApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (!configured) {
    return DEFAULT_API_URL;
  }
  const relativeOrAbsolute = new URL(configured, window.location.origin);
  return relativeOrAbsolute.toString().replace(/\/$/, '');
}

function resolveWsBaseUrl(apiBaseUrl: string): string {
  const configured = import.meta.env.VITE_WS_URL?.trim();
  if (configured) {
    const url = new URL(configured, window.location.origin);
    if (url.protocol === 'http:') {
      url.protocol = 'ws:';
    } else if (url.protocol === 'https:') {
      url.protocol = 'wss:';
    }
    return url.toString().replace(/\/$/, '');
  }

  const apiUrl = new URL(apiBaseUrl, window.location.origin);
  const protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${apiUrl.host}${apiUrl.pathname.replace(/\/$/, '')}/ws`;
}

export const API_BASE_URL = resolveApiBaseUrl();
export const WS_BASE_URL = resolveWsBaseUrl(API_BASE_URL);

export function buildInviteUrl(roomCode: string): string {
  return `${window.location.origin}/r/${encodeURIComponent(roomCode)}`;
}
