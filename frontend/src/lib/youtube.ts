const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

const PATH_PREFIXES = ['embed', 'shorts', 'live'];

export function isYouTubeVideoId(value: string): boolean {
  return VIDEO_ID_PATTERN.test(value);
}

export function extractYouTubeVideoId(rawUrl: string): string | null {
  const value = rawUrl.trim();
  if (!value) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) {
    return null;
  }

  if (host === 'youtu.be' || host === 'www.youtu.be') {
    const candidate = url.pathname.split('/').filter(Boolean)[0];
    return candidate && isYouTubeVideoId(candidate) ? candidate : null;
  }

  if (url.pathname === '/watch') {
    const candidate = url.searchParams.get('v');
    return candidate && isYouTubeVideoId(candidate) ? candidate : null;
  }

  const [, prefix, candidate] = url.pathname.split('/');
  if (prefix && PATH_PREFIXES.includes(prefix) && candidate && isYouTubeVideoId(candidate)) {
    return candidate;
  }

  return null;
}

export function canonicalYouTubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
