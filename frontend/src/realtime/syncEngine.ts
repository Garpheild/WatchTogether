import type { PlaybackState } from '@/api/types';
import type { PlayerAdapter, PlayerEvent } from '@/player/types';

const SUPPRESS_FEEDBACK_MS = 1500;
const BLOCKED_CHECK_MS = 2100;
const USER_SEEK_THRESHOLD_SECONDS = 2;
const WATCHDOG_INTERVAL_MS = 5000;
const SEEK_DETECTOR_INTERVAL_MS = 500;
const DRIFT_SEEK_THRESHOLD_SECONDS = 1.5;
const DRIFT_RESYNC_THRESHOLD_SECONDS = 3;
const SYNC_REQUEST_COOLDOWN_MS = 5000;

export interface SyncEngineCallbacks {
  sendCommand: (action: 'play' | 'pause' | 'seek', positionSeconds: number) => void;
  requestSync: () => void;
  onPlaybackBlocked?: (blocked: boolean) => void;
}

interface PlaybackAnchor {
  expected: number;
  at: number;
  isPlaying: boolean;
}

interface PendingPlayback {
  state: PlaybackState;
  serverTime: string;
}

function expectedPosition(anchor: PlaybackAnchor, now: number): number {
  const elapsed = anchor.isPlaying ? Math.max(0, (now - anchor.at) / 1000) : 0;
  return anchor.expected + elapsed;
}

function parseServerTarget(state: PlaybackState, serverTime: string): number {
  const serverMs = Date.parse(serverTime);
  const updatedMs = Date.parse(state.updated_at);
  if (!Number.isFinite(serverMs) || !Number.isFinite(updatedMs)) {
    return state.position_seconds;
  }
  const elapsed = state.is_playing ? Math.max(0, (serverMs - updatedMs) / 1000) : 0;
  return state.position_seconds + elapsed;
}

export class PlaybackSyncEngine {
  private readonly player: PlayerAdapter;
  private readonly callbacks: SyncEngineCallbacks;
  private readonly unsubscribe: () => void;
  private readonly watchdogTimer: number;
  private readonly seekDetectorTimer: number;
  private anchor: PlaybackAnchor | null = null;
  private pending: PendingPlayback | null = null;
  private localRevision = -1;
  private currentVideoId: string | null = null;
  private suppressUntil = 0;
  private blockedTimer: number | null = null;
  private driftStreak = 0;
  private lastSyncRequestAt = 0;
  private disposed = false;

  constructor(player: PlayerAdapter, callbacks: SyncEngineCallbacks) {
    this.player = player;
    this.callbacks = callbacks;
    this.unsubscribe = player.subscribe((event) => this.handlePlayerEvent(event));
    this.watchdogTimer = window.setInterval(() => this.runWatchdog(), WATCHDOG_INTERVAL_MS);
    this.seekDetectorTimer = window.setInterval(
      () => this.detectUserSeek(),
      SEEK_DETECTOR_INTERVAL_MS,
    );
  }

  applyRemotePlayback(state: PlaybackState, serverTime: string): void {
    if (this.disposed || state.revision < this.localRevision) {
      return;
    }
    this.localRevision = state.revision;

    if (!state.video_id) {
      this.currentVideoId = null;
      this.anchor = { expected: 0, at: performance.now(), isPlaying: false };
      this.pending = null;
      this.callbacks.onPlaybackBlocked?.(false);
      this.player.pause();
      return;
    }

    const target = parseServerTarget(state, serverTime);
    const videoChanged = state.video_id !== this.currentVideoId;

    if (!this.player.isReady()) {
      this.pending = { state, serverTime };
      return;
    }

    this.currentVideoId = state.video_id;
    this.pending = null;
    this.anchor = {
      expected: target,
      at: performance.now(),
      isPlaying: state.is_playing,
    };
    this.suppressUntil = performance.now() + SUPPRESS_FEEDBACK_MS;

    if (videoChanged) {
      this.player.load(state.video_id, target);
      if (state.is_playing) {
        this.player.play();
      }
      this.scheduleBlockedCheck(state.is_playing);
      return;
    }

    const status = this.player.getStatus();
    if (state.is_playing) {
      if (status !== 'playing' && status !== 'buffering') {
        this.player.play();
      }
    } else if (status !== 'paused' && status !== 'unstarted') {
      this.player.pause();
    }

    if (status !== 'buffering' && status !== 'unstarted') {
      const drift = this.player.getCurrentTime() - target;
      if (Math.abs(drift) > 1) {
        this.player.seekTo(target);
      }
    }

    this.scheduleBlockedCheck(state.is_playing);
  }

  retryPlay(): void {
    if (this.disposed) {
      return;
    }
    this.callbacks.onPlaybackBlocked?.(false);
    this.player.play();
    this.scheduleBlockedCheck(true);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    window.clearInterval(this.watchdogTimer);
    window.clearInterval(this.seekDetectorTimer);
    if (this.blockedTimer !== null) {
      window.clearTimeout(this.blockedTimer);
      this.blockedTimer = null;
    }
    this.unsubscribe();
  }

  private handlePlayerEvent(event: PlayerEvent): void {
    if (this.disposed) {
      return;
    }
    if (event.type === 'ready') {
      const pending = this.pending;
      this.pending = null;
      if (pending) {
        this.applyRemotePlayback(pending.state, pending.serverTime);
      }
      return;
    }
    if (event.type === 'error') {
      return;
    }

    if (event.status === 'playing') {
      this.callbacks.onPlaybackBlocked?.(false);
    }

    if (performance.now() < this.suppressUntil) {
      return;
    }

    if (event.status === 'ended') {
      const duration = this.player.getDuration();
      this.callbacks.sendCommand('pause', duration);
      this.anchor = { expected: duration, at: performance.now(), isPlaying: false };
      return;
    }

    if (event.status === 'playing' && this.anchor && !this.anchor.isPlaying) {
      const position = this.player.getCurrentTime();
      this.callbacks.sendCommand('play', position);
      this.anchor = { expected: position, at: performance.now(), isPlaying: true };
      return;
    }

    if (event.status === 'paused' && this.anchor?.isPlaying) {
      const position = this.player.getCurrentTime();
      this.callbacks.sendCommand('pause', position);
      this.anchor = { expected: position, at: performance.now(), isPlaying: false };
    }
  }

  private detectUserSeek(): void {
    if (this.disposed || performance.now() < this.suppressUntil) {
      return;
    }
    const anchor = this.anchor;
    if (!anchor || !this.player.isReady()) {
      return;
    }
    const status = this.player.getStatus();
    if (status === 'buffering' || status === 'unstarted' || status === 'ended') {
      return;
    }

    const now = performance.now();
    const expected = expectedPosition(anchor, now);
    const current = this.player.getCurrentTime();
    if (Math.abs(current - expected) > USER_SEEK_THRESHOLD_SECONDS) {
      this.callbacks.sendCommand('seek', current);
      this.anchor = { expected: current, at: now, isPlaying: anchor.isPlaying };
    }
  }

  private runWatchdog(): void {
    if (this.disposed || performance.now() < this.suppressUntil) {
      return;
    }
    const anchor = this.anchor;
    if (!anchor || !this.player.isReady()) {
      return;
    }
    const status = this.player.getStatus();
    if (status === 'buffering' || status === 'unstarted') {
      return;
    }

    const now = performance.now();
    const expected = expectedPosition(anchor, now);
    const current = this.player.getCurrentTime();
    const drift = current - expected;

    if (Math.abs(drift) > DRIFT_SEEK_THRESHOLD_SECONDS) {
      this.player.seekTo(expected);
      this.anchor = { expected, at: now, isPlaying: anchor.isPlaying };
    }

    if (Math.abs(drift) > DRIFT_RESYNC_THRESHOLD_SECONDS) {
      this.driftStreak += 1;
    } else {
      this.driftStreak = 0;
    }

    if (this.driftStreak >= 2 && now - this.lastSyncRequestAt > SYNC_REQUEST_COOLDOWN_MS) {
      this.lastSyncRequestAt = now;
      this.driftStreak = 0;
      this.callbacks.requestSync();
    }

    if (anchor.isPlaying && status === 'paused') {
      this.player.play();
    } else if (!anchor.isPlaying && status === 'playing') {
      this.player.pause();
    }
  }

  private scheduleBlockedCheck(shouldPlay: boolean): void {
    if (this.blockedTimer !== null) {
      window.clearTimeout(this.blockedTimer);
      this.blockedTimer = null;
    }
    if (!shouldPlay) {
      this.callbacks.onPlaybackBlocked?.(false);
      return;
    }

    this.blockedTimer = window.setTimeout(() => {
      this.blockedTimer = null;
      if (this.disposed || !this.player.isReady()) {
        return;
      }
      const status = this.player.getStatus();
      const blocked = status !== 'playing' && status !== 'buffering';
      this.callbacks.onPlaybackBlocked?.(blocked);
    }, BLOCKED_CHECK_MS);
  }
}
