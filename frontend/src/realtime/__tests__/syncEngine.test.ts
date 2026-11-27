import { describe, expect, it } from 'vitest';

import type { PlaybackState } from '@/api/types';
import type { PlayerAdapter, PlayerEvent, PlayerStatus } from '@/player/types';

import { PlaybackSyncEngine } from '../syncEngine';

const SERVER_TIME = '2026-11-24T18:07:12.480Z';

class MockPlayer implements PlayerAdapter {
  ready = true;
  status: PlayerStatus = 'paused';
  currentTime = 0;
  duration = 120;
  loaded: Array<{ videoId: string; startSeconds: number }> = [];
  plays = 0;
  pauses = 0;
  seeks: number[] = [];
  private readonly listeners = new Set<(event: PlayerEvent) => void>();

  load(videoId: string, startSeconds: number): void {
    this.loaded.push({ videoId, startSeconds });
    this.currentTime = startSeconds;
    this.status = 'paused';
  }

  play(): void {
    this.plays += 1;
    this.status = 'playing';
  }

  pause(): void {
    this.pauses += 1;
    this.status = 'paused';
  }

  seekTo(seconds: number): void {
    this.seeks.push(seconds);
    this.currentTime = seconds;
  }

  getCurrentTime(): number {
    return this.currentTime;
  }

  getDuration(): number {
    return this.duration;
  }

  getStatus(): PlayerStatus {
    return this.status;
  }

  isReady(): boolean {
    return this.ready;
  }

  subscribe(listener: (event: PlayerEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: PlayerEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

function state(overrides: Partial<PlaybackState>): PlaybackState {
  return {
    video_id: 'dQw4w9WgXcQ',
    video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    is_playing: false,
    position_seconds: 0,
    updated_at: SERVER_TIME,
    revision: 1,
    updated_by_participant_id: null,
    ...overrides,
  };
}

describe('PlaybackSyncEngine', () => {
  it('loads a new video and resumes playback when the room is playing', () => {
    const player = new MockPlayer();
    const engine = new PlaybackSyncEngine(player, {
      sendCommand: () => undefined,
      requestSync: () => undefined,
    });

    engine.applyRemotePlayback(
      state({ revision: 3, is_playing: true, position_seconds: 42 }),
      SERVER_TIME,
    );

    expect(player.loaded).toEqual([{ videoId: 'dQw4w9WgXcQ', startSeconds: 42 }]);
    expect(player.plays).toBe(1);
    engine.dispose();
  });

  it('seeks when an already loaded video receives a far position', () => {
    const player = new MockPlayer();
    const engine = new PlaybackSyncEngine(player, {
      sendCommand: () => undefined,
      requestSync: () => undefined,
    });

    engine.applyRemotePlayback(state({ revision: 1, position_seconds: 0 }), SERVER_TIME);
    player.currentTime = 0;
    engine.applyRemotePlayback(state({ revision: 2, position_seconds: 100 }), SERVER_TIME);

    expect(player.loaded).toHaveLength(1);
    expect(player.seeks).toContain(100);
    engine.dispose();
  });

  it('ignores states with an older revision', () => {
    const player = new MockPlayer();
    const engine = new PlaybackSyncEngine(player, {
      sendCommand: () => undefined,
      requestSync: () => undefined,
    });

    engine.applyRemotePlayback(
      state({ revision: 5, video_id: 'aaaaaaaaaaa', position_seconds: 10 }),
      SERVER_TIME,
    );
    engine.applyRemotePlayback(
      state({ revision: 2, video_id: 'bbbbbbbbbbb', position_seconds: 50 }),
      SERVER_TIME,
    );

    expect(player.loaded.map((entry) => entry.videoId)).toEqual(['aaaaaaaaaaa']);
    engine.dispose();
  });

  it('waits for the player to become ready before applying a snapshot', () => {
    const player = new MockPlayer();
    player.ready = false;
    const engine = new PlaybackSyncEngine(player, {
      sendCommand: () => undefined,
      requestSync: () => undefined,
    });

    engine.applyRemotePlayback(
      state({ revision: 1, video_id: 'ccccccccccc', position_seconds: 15 }),
      SERVER_TIME,
    );
    expect(player.loaded).toHaveLength(0);

    player.ready = true;
    player.emit({ type: 'ready' });

    expect(player.loaded).toEqual([{ videoId: 'ccccccccccc', startSeconds: 15 }]);
    engine.dispose();
  });
});
