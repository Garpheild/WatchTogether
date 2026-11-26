import { ApiError } from '@/api/client';

import type {
  ClientEnvelope,
  ConnectionStatus,
  FatalConnectionReason,
  ServerEnvelope,
  WS_CLOSE_CODES,
} from './protocol';
import { WS_CLOSE_CODES as CLOSE } from './protocol';

const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 15000];
const HEARTBEAT_INTERVAL_MS = 20000;

export interface RealtimeSocketOptions {
  roomCode: string;
  wsBaseUrl: string;
  getTicket: () => Promise<{ ticket: string }>;
  onEvent: (event: ServerEnvelope) => void;
  onStatus: (status: ConnectionStatus) => void;
  onFatal: (reason: FatalConnectionReason) => void;
}

type CloseCode = (typeof WS_CLOSE_CODES)[keyof typeof WS_CLOSE_CODES];

export class RealtimeSocket {
  private readonly options: RealtimeSocketOptions;
  private socket: WebSocket | null = null;
  private started = false;
  private stopped = false;
  private fatal = false;
  private connecting = false;
  private attempt = 0;
  private generation = 0;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private status: ConnectionStatus = 'closed';

  constructor(options: RealtimeSocketOptions) {
    this.options = options;
  }

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.stopped = false;
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.connect();
  }

  stop(): void {
    if (!this.started) {
      return;
    }
    this.stopped = true;
    this.started = false;
    this.clearReconnectTimer();
    this.stopHeartbeat();
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);

    const socket = this.socket;
    this.socket = null;
    this.generation += 1;
    if (socket) {
      socket.onclose = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onopen = null;
      try {
        socket.close(CLOSE.normal, 'client disconnect');
      } catch {
        // The socket may already be closed.
      }
    }
    this.connecting = false;
  }

  send(type: string, payload: unknown, requestId?: string): boolean {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    const envelope: ClientEnvelope = requestId
      ? { type, request_id: requestId, payload }
      : { type, payload };
    try {
      socket.send(JSON.stringify(envelope));
      return true;
    } catch {
      return false;
    }
  }

  isOpen(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  private connect(): void {
    if (this.stopped || this.fatal || this.connecting) {
      return;
    }
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) {
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.setStatus('reconnecting');
      return;
    }

    this.connecting = true;
    this.setStatus(this.attempt === 0 ? 'connecting' : 'reconnecting');

    this.options
      .getTicket()
      .then(({ ticket }) => {
        if (this.stopped || this.fatal) {
          this.connecting = false;
          return;
        }
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          this.connecting = false;
          this.setStatus('reconnecting');
          return;
        }
        this.openSocket(ticket);
      })
      .catch((error: unknown) => {
        this.connecting = false;
        if (this.stopped || this.fatal) {
          return;
        }
        if (this.handleFatalError(error)) {
          return;
        }
        this.scheduleReconnect();
      });
  }

  private openSocket(ticket: string): void {
    const base = this.options.wsBaseUrl.replace(/\/$/, '');
    const url = `${base}/rooms/${encodeURIComponent(this.options.roomCode)}?ticket=${encodeURIComponent(ticket)}`;

    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch {
      this.connecting = false;
      this.scheduleReconnect();
      return;
    }

    const generation = (this.generation += 1);
    this.socket = socket;

    socket.onopen = () => {
      if (generation !== this.generation) {
        socket.close();
        return;
      }
      this.connecting = false;
      this.attempt = 0;
      this.setStatus('open');
      this.startHeartbeat();
    };

    socket.onmessage = (message) => {
      if (generation !== this.generation || typeof message.data !== 'string') {
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(message.data) as unknown;
      } catch {
        return;
      }
      if (
        parsed &&
        typeof parsed === 'object' &&
        typeof (parsed as { type?: unknown }).type === 'string'
      ) {
        this.options.onEvent(parsed as ServerEnvelope);
      }
    };

    socket.onerror = () => {
      // The close handler performs the actual recovery.
    };

    socket.onclose = (event) => {
      if (generation !== this.generation) {
        return;
      }
      this.socket = null;
      this.connecting = false;
      this.stopHeartbeat();
      this.handleClose(event.code);
    };
  }

  private handleClose(code: number): void {
    if (this.stopped || this.fatal) {
      return;
    }

    const closeCode = code as CloseCode;
    switch (closeCode) {
      case CLOSE.roomClosed:
        this.fatal = true;
        this.setStatus('closed');
        this.options.onFatal('room_closed');
        return;
      case CLOSE.invalidTicket:
        this.fatal = true;
        this.setStatus('error');
        this.options.onFatal('invalid_token');
        return;
      case CLOSE.forbidden:
        this.fatal = true;
        this.setStatus('error');
        this.options.onFatal('forbidden');
        return;
      case CLOSE.roomNotFound:
        this.fatal = true;
        this.setStatus('error');
        this.options.onFatal('room_not_found');
        return;
      case CLOSE.rateLimited:
        this.fatal = true;
        this.setStatus('error');
        this.options.onFatal('rate_limited');
        return;
      default:
        break;
    }

    this.setStatus('reconnecting');
    this.scheduleReconnect();
  }

  private handleFatalError(error: unknown): boolean {
    if (!(error instanceof ApiError)) {
      return false;
    }
    switch (error.code) {
      case 'invalid_token':
        this.fatal = true;
        this.setStatus('error');
        this.options.onFatal('invalid_token');
        return true;
      case 'forbidden':
        this.fatal = true;
        this.setStatus('error');
        this.options.onFatal('forbidden');
        return true;
      case 'room_not_found':
        this.fatal = true;
        this.setStatus('error');
        this.options.onFatal('room_not_found');
        return true;
      case 'room_closed':
        this.fatal = true;
        this.setStatus('closed');
        this.options.onFatal('room_closed');
        return true;
      case 'rate_limited':
        this.fatal = true;
        this.setStatus('error');
        this.options.onFatal('rate_limited');
        return true;
      default:
        return false;
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.fatal) {
      return;
    }
    this.clearReconnectTimer();
    const index = Math.min(this.attempt, RECONNECT_DELAYS_MS.length - 1);
    const base = RECONNECT_DELAYS_MS[index];
    const jitter = 0.8 + Math.random() * 0.4;
    this.attempt += 1;
    this.setStatus('reconnecting');
    this.reconnectTimer = window.setTimeout(
      () => {
        this.reconnectTimer = null;
        this.connect();
      },
      Math.round(base * jitter),
    );
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      if (!this.isOpen()) {
        return;
      }
      this.send('ping', { client_time: new Date().toISOString() });
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status === status) {
      return;
    }
    this.status = status;
    this.options.onStatus(status);
  }

  private handleOnline = (): void => {
    if (this.stopped || this.fatal) {
      return;
    }
    this.clearReconnectTimer();
    this.attempt = 0;
    this.connect();
  };

  private handleOffline = (): void => {
    if (this.stopped || this.fatal) {
      return;
    }
    this.clearReconnectTimer();
    this.connecting = false;
    const socket = this.socket;
    this.socket = null;
    this.generation += 1;
    if (socket) {
      socket.onclose = null;
      try {
        socket.close();
      } catch {
        // The browser may already have closed the socket.
      }
    }
    this.setStatus('reconnecting');
  };

  private handleVisibilityChange = (): void => {
    if (this.stopped || this.fatal) {
      return;
    }
    if (document.visibilityState === 'visible' && this.status === 'reconnecting') {
      this.clearReconnectTimer();
      this.connect();
    }
  };
}
