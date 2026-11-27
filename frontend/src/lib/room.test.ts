import { describe, expect, it } from 'vitest';

import { normalizeRoomCode } from './room';

describe('normalizeRoomCode', () => {
  it('accepts a plain code and lowercases it', () => {
    expect(normalizeRoomCode('K7M2P9QX')).toBe('k7m2p9qx');
  });

  it('accepts an invite url', () => {
    expect(normalizeRoomCode('http://localhost:5173/r/k7m2p9qx')).toBe('k7m2p9qx');
  });

  it('rejects empty and invalid values', () => {
    expect(normalizeRoomCode('   ')).toBeNull();
    expect(normalizeRoomCode('bad code')).toBeNull();
    expect(normalizeRoomCode('https://example.com/room/a')).toBeNull();
  });

  it('extracts the last path segment from other invite layouts', () => {
    expect(normalizeRoomCode('https://example.com/room/k7m2p9qx')).toBe('k7m2p9qx');
  });
});
