import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConnectionStatus, FatalConnectionReason } from '../protocol';
import { RealtimeSocket } from '../socket';

class MockWebSocket {
  static readonly OPEN = 1;
  static instances: MockWebSocket[] = [];

  readonly url: string;
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  open(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  receive(data: string): void {
    this.onmessage?.({ data });
  }

  close(code = 1000): void {
    if (this.readyState === 3) {
      return;
    }
    this.readyState = 3;
    this.onclose?.({ code });
  }

  send(data: string): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('socket is not open');
    }
    this.sent.push(data);
  }
}

async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

describe('RealtimeSocket', () => {
  let socket: RealtimeSocket | null = null;
  let statuses: ConnectionStatus[] = [];
  let fatalReasons: FatalConnectionReason[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    MockWebSocket.instances = [];
    statuses = [];
    fatalReasons = [];
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    socket?.stop();
    socket = null;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function createSocket(): RealtimeSocket {
    socket = new RealtimeSocket({
      roomCode: 'k7m2p9qx',
      wsBaseUrl: 'ws://localhost:8000/api/v1/ws',
      getTicket: () => Promise.resolve({ ticket: 'ticket-1' }),
      onEvent: () => undefined,
      onStatus: (status) => statuses.push(status),
      onFatal: (reason) => fatalReasons.push(reason),
    });
    return socket;
  }

  it('connects with a ticket and reports an open connection', async () => {
    const realtime = createSocket();
    realtime.start();
    await flush();

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toBe(
      'ws://localhost:8000/api/v1/ws/rooms/k7m2p9qx?ticket=ticket-1',
    );

    MockWebSocket.instances[0].open();
    expect(statuses).toEqual(['connecting', 'open']);
    expect(realtime.isOpen()).toBe(true);
  });

  it('reconnects after an abnormal close', async () => {
    const realtime = createSocket();
    realtime.start();
    await flush();
    MockWebSocket.instances[0].open();

    MockWebSocket.instances[0].close(1006);
    expect(statuses.at(-1)).toBe('reconnecting');

    await vi.advanceTimersByTimeAsync(1000);
    await flush();
    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it('treats an invalid ticket close as fatal', async () => {
    const realtime = createSocket();
    realtime.start();
    await flush();
    MockWebSocket.instances[0].open();

    MockWebSocket.instances[0].close(4401);
    expect(fatalReasons).toEqual(['invalid_token']);
    expect(statuses.at(-1)).toBe('error');

    await vi.advanceTimersByTimeAsync(60_000);
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(realtime.isOpen()).toBe(false);
  });

  it('dispatches only JSON messages with a type', async () => {
    const events: unknown[] = [];
    socket = new RealtimeSocket({
      roomCode: 'k7m2p9qx',
      wsBaseUrl: 'ws://localhost:8000/api/v1/ws',
      getTicket: () => Promise.resolve({ ticket: 'ticket-1' }),
      onEvent: (event) => events.push(event),
      onStatus: () => undefined,
      onFatal: () => undefined,
    });
    socket.start();
    await flush();

    const connection = MockWebSocket.instances[0];
    connection.open();
    connection.receive('not json');
    connection.receive(JSON.stringify({ hello: 'world' }));
    connection.receive(JSON.stringify({ type: 'pong', payload: { client_time: null } }));

    expect(events).toEqual([{ type: 'pong', payload: { client_time: null } }]);
  });
});
