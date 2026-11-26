import type { PlayerAdapter, PlayerEvent, PlayerStatus } from './types';

const API_SCRIPT_ID = 'youtube-iframe-api';
const API_SCRIPT_SRC = 'https://www.youtube.com/iframe_api';

let apiPromise: Promise<void> | null = null;

export function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) {
    return Promise.resolve();
  }
  if (apiPromise) {
    return apiPromise;
  }

  apiPromise = new Promise<void>((resolve, reject) => {
    let settled = false;
    let pollTimer = 0;
    let timeoutTimer = 0;

    const cleanup = () => {
      window.clearInterval(pollTimer);
      window.clearTimeout(timeoutTimer);
    };

    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve();
    };

    const fail = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      apiPromise = null;
      document.getElementById(API_SCRIPT_ID)?.remove();
      reject(new Error('Не удалось загрузить YouTube IFrame API'));
    };

    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      finish();
    };

    pollTimer = window.setInterval(() => {
      if (window.YT?.Player) {
        finish();
      }
    }, 200);
    timeoutTimer = window.setTimeout(fail, 20000);

    if (!document.getElementById(API_SCRIPT_ID)) {
      const script = document.createElement('script');
      script.id = API_SCRIPT_ID;
      script.src = API_SCRIPT_SRC;
      script.async = true;
      script.onerror = fail;
      document.head.appendChild(script);
    }
  });

  return apiPromise;
}

function mapStatus(value: number): PlayerStatus {
  const states = window.YT?.PlayerState;
  if (!states) {
    return 'unstarted';
  }
  switch (value) {
    case states.PLAYING:
      return 'playing';
    case states.PAUSED:
      return 'paused';
    case states.BUFFERING:
      return 'buffering';
    case states.ENDED:
      return 'ended';
    case states.CUED:
    case states.UNSTARTED:
    default:
      return 'unstarted';
  }
}

export class YouTubePlayerAdapter implements PlayerAdapter {
  private readonly player: YTPlayerLike;
  private readonly host: HTMLElement;
  private readonly listeners = new Set<(event: PlayerEvent) => void>();
  private ready = false;
  private destroyed = false;
  private status: PlayerStatus = 'unstarted';

  constructor(player: YTPlayerLike, host: HTMLElement) {
    this.player = player;
    this.host = host;
  }

  notifyReady(): void {
    if (this.destroyed) {
      return;
    }
    this.ready = true;
    this.status = mapStatus(this.safeGetPlayerState());
    this.emit({ type: 'ready' });
  }

  handleStateChange(value: number): void {
    if (this.destroyed) {
      return;
    }
    const status = mapStatus(value);
    if (status !== this.status) {
      this.status = status;
      this.emit({ type: 'status_changed', status });
    }
  }

  handleError(code: number): void {
    if (this.destroyed) {
      return;
    }
    this.emit({ type: 'error', code });
  }

  load(videoId: string, startSeconds: number): void {
    if (!this.ready || this.destroyed) {
      return;
    }
    this.status = 'unstarted';
    this.player.cueVideoById({
      videoId,
      startSeconds: Math.max(0, Math.floor(startSeconds)),
    });
  }

  play(): void {
    if (this.ready && !this.destroyed) {
      this.player.playVideo();
    }
  }

  pause(): void {
    if (this.ready && !this.destroyed) {
      this.player.pauseVideo();
    }
  }

  seekTo(seconds: number): void {
    if (this.ready && !this.destroyed) {
      this.player.seekTo(Math.max(0, seconds), true);
    }
  }

  getCurrentTime(): number {
    if (!this.ready || this.destroyed) {
      return 0;
    }
    const value = this.player.getCurrentTime();
    return Number.isFinite(value) ? value : 0;
  }

  getDuration(): number {
    if (!this.ready || this.destroyed) {
      return 0;
    }
    const value = this.player.getDuration();
    return Number.isFinite(value) ? value : 0;
  }

  getStatus(): PlayerStatus {
    return this.status;
  }

  isReady(): boolean {
    return this.ready && !this.destroyed;
  }

  subscribe(listener: (event: PlayerEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.listeners.clear();
    try {
      this.player.destroy();
    } catch {
      // The iframe may already be removed by React or the browser.
    }
    this.host.remove();
  }

  private safeGetPlayerState(): number {
    try {
      return this.player.getPlayerState();
    } catch {
      return -1;
    }
  }

  private emit(event: PlayerEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

export interface CreateYouTubePlayerOptions {
  videoId?: string;
  onError?: (message: string) => void;
}

export function createYouTubePlayer(
  container: HTMLElement,
  options: CreateYouTubePlayerOptions = {},
): Promise<YouTubePlayerAdapter> {
  return loadYouTubeApi().then(
    () =>
      new Promise<YouTubePlayerAdapter>((resolve, reject) => {
        const mount = document.createElement('div');
        mount.className = 'h-full w-full';
        container.appendChild(mount);

        let adapter: YouTubePlayerAdapter | null = null;

        try {
          const player = new window.YT!.Player(mount, {
            width: '100%',
            height: '100%',
            videoId: options.videoId,
            playerVars: {
              autoplay: 0,
              controls: 1,
              modestbranding: 1,
              rel: 0,
              playsinline: 1,
              origin: window.location.origin,
            },
            events: {
              onReady: () => {
                if (!adapter) {
                  return;
                }
                adapter.notifyReady();
                resolve(adapter);
              },
              onStateChange: (event) => {
                adapter?.handleStateChange(event.data);
              },
              onError: (event) => {
                const message =
                  event.data === 101 || event.data === 150
                    ? 'Владелец видео запретил встраивание на других сайтах.'
                    : 'YouTube не смог воспроизвести это видео.';
                options.onError?.(message);
                adapter?.handleError(event.data);
              },
            },
          });
          adapter = new YouTubePlayerAdapter(player, mount);
        } catch (error) {
          mount.remove();
          reject(error instanceof Error ? error : new Error('Не удалось создать плеер'));
        }
      }),
  );
}
