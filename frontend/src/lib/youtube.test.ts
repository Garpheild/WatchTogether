import { describe, expect, it } from 'vitest';

import { canonicalYouTubeUrl, extractYouTubeVideoId, isYouTubeVideoId } from './youtube';

describe('extractYouTubeVideoId', () => {
  it.each([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s',
    'https://youtu.be/dQw4w9WgXcQ?si=abc',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'https://youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube.com/live/dQw4w9WgXcQ',
    'https://music.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
  ])('extracts the id from %s', (url) => {
    expect(extractYouTubeVideoId(url)).toBe('dQw4w9WgXcQ');
  });

  it.each([
    '',
    'not a url',
    'https://example.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.evil.tld/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=short',
    'javascript:alert(1)',
    'https://youtu.be/',
  ])('rejects %s', (url) => {
    expect(extractYouTubeVideoId(url)).toBeNull();
  });
});

describe('isYouTubeVideoId', () => {
  it('accepts canonical 11-character ids', () => {
    expect(isYouTubeVideoId('dQw4w9WgXcQ')).toBe(true);
    expect(isYouTubeVideoId('dQw4w9WgXc')).toBe(false);
  });
});

describe('canonicalYouTubeUrl', () => {
  it('builds a canonical watch url', () => {
    expect(canonicalYouTubeUrl('dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });
});
