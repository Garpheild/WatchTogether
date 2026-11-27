export type PlayerStatus = 'unstarted' | 'playing' | 'paused' | 'buffering' | 'ended';

export interface PlayerAdapter {
  load(videoId: string, startSeconds: number): void;
  play(): void;
  pause(): void;
  seekTo(seconds: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  getStatus(): PlayerStatus;
  isReady(): boolean;
  subscribe(listener: (event: PlayerEvent) => void): () => void;
}

export type PlayerEvent =
  | { type: 'ready' }
  | { type: 'status_changed'; status: PlayerStatus }
  | { type: 'error'; code: number };
