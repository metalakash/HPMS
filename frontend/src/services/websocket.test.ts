import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { NotificationEvent } from '@/types/api';
import { NotificationSocket, type SocketStatus } from './websocket';

/** Minimal controllable stand-in for the browser WebSocket. */
class FakeSocket {
  readyState: number = WebSocket.CONNECTING;
  sent: unknown[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  constructor(public url: string) {}
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close = vi.fn();
  open() {
    this.readyState = WebSocket.OPEN;
    this.onopen?.();
  }
  receive(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
  serverClose(code: number) {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.({ code });
  }
}

const event: NotificationEvent = {
  id: 'evt-1',
  type: 'project_updated',
  user_id: 'u-1',
  data: { project_id: 'p-1' },
  priority: 'high',
  title: 'Project updated',
  message: null,
  timestamp: '2026-09-24T00:00:00Z',
};

describe('NotificationSocket', () => {
  let sockets: FakeSocket[];
  let statuses: SocketStatus[];
  let onEvent: Mock<(event: NotificationEvent) => void>;
  let token: string | null;

  const create = () =>
    new NotificationSocket({
      getToken: () => token,
      onEvent,
      onStatus: (s) => statuses.push(s),
      createSocket: (url) => {
        const socket = new FakeSocket(url);
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
    });

  beforeEach(() => {
    vi.useFakeTimers();
    sockets = [];
    statuses = [];
    onEvent = vi.fn<(event: NotificationEvent) => void>();
    token = 'jwt value';
  });
  afterEach(() => vi.useRealTimers());

  it('connects with the token as an encoded query param', () => {
    create().connect();
    expect(sockets[0]?.url).toBe('ws://localhost:3000/ws/notifications?token=jwt%20value');
    sockets[0]?.open();
    expect(statuses).toEqual(['connecting', 'open']);
  });

  it('delivers events and acks them by message_id', () => {
    create().connect();
    const socket = sockets[0]!;
    socket.open();
    socket.receive({ type: 'event', data: event, message_id: 'evt-1', timestamp: '' });

    expect(onEvent).toHaveBeenCalledWith(event);
    expect(socket.sent).toEqual([{ type: 'ack', message_id: 'evt-1' }]);
  });

  it('ignores heartbeats, acks and malformed frames', () => {
    create().connect();
    const socket = sockets[0]!;
    socket.open();
    socket.receive({ type: 'heartbeat', data: {}, message_id: null, timestamp: '' });
    socket.receive({ type: 'ack', data: { message_id: 'x' }, message_id: null, timestamp: '' });
    socket.onmessage?.({ data: 'not json' });

    expect(onEvent).not.toHaveBeenCalled();
    expect(socket.sent).toEqual([]);
  });

  it('reconnects with exponential backoff and resets after a successful open', () => {
    create().connect();
    sockets[0]!.serverClose(1006);
    expect(statuses.at(-1)).toBe('closed');

    vi.advanceTimersByTime(999);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);

    sockets[1]!.serverClose(1006);
    vi.advanceTimersByTime(1_999);
    expect(sockets).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(3);

    sockets[2]!.open();
    sockets[2]!.serverClose(1006);
    vi.advanceTimersByTime(1_000);
    expect(sockets).toHaveLength(4);
  });

  it('stops retrying when the server rejects the token (1008)', () => {
    create().connect();
    sockets[0]!.serverClose(1008);
    vi.advanceTimersByTime(60_000);

    expect(sockets).toHaveLength(1);
    expect(statuses.at(-1)).toBe('unauthorized');
  });

  it('does not open a socket without a token', () => {
    token = null;
    create().connect();
    expect(sockets).toHaveLength(0);
    expect(statuses).toEqual(['unauthorized']);
  });

  it('does not reconnect after disconnect()', () => {
    const client = create();
    client.connect();
    const socket = sockets[0]!;
    client.disconnect();
    socket.serverClose(1000);
    vi.advanceTimersByTime(60_000);

    expect(socket.close).toHaveBeenCalledWith(1000, 'client disconnect');
    expect(sockets).toHaveLength(1);
    expect(statuses.at(-1)).toBe('closed');
  });
});
