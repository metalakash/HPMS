import { websocketUrl } from '@/config';
import type { NotificationEvent, WsMessage } from '@/types/api';

export type SocketStatus = 'connecting' | 'open' | 'closed' | 'unauthorized';

export interface NotificationSocketOptions {
  getToken: () => string | null;
  onEvent: (event: NotificationEvent) => void;
  onStatus?: (status: SocketStatus) => void;
  /** Injectable for tests. */
  createSocket?: (url: string) => WebSocket;
  maxBackoffMs?: number;
}

/** RFC 6455 policy violation: the backend's code for a missing/invalid token. */
const POLICY_VIOLATION = 1008;
const INITIAL_BACKOFF_MS = 1_000;

/**
 * Client for /ws/notifications (backend/app/api/routes_ws.py).
 *
 * The server auto-subscribes on connect, sends a heartbeat every 30s and
 * replays pending events after a reconnect. The client acks each event and
 * reconnects with exponential backoff, except after an auth rejection, where
 * retrying with the same token cannot succeed.
 */
export class NotificationSocket {
  private socket: WebSocket | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = INITIAL_BACKOFF_MS;
  private stopped = true;

  constructor(private readonly options: NotificationSocketOptions) {}

  connect(): void {
    this.stopped = false;
    this.open();
  }

  disconnect(): void {
    this.stopped = true;
    this.clearRetry();
    const socket = this.socket;
    this.socket = null;
    socket?.close(1000, 'client disconnect');
    this.options.onStatus?.('closed');
  }

  private open(): void {
    const token = this.options.getToken();
    if (!token) {
      this.options.onStatus?.('unauthorized');
      return;
    }

    const url = `${websocketUrl('/ws/notifications')}?token=${encodeURIComponent(token)}`;
    const socket = (this.options.createSocket ?? ((u) => new WebSocket(u)))(url);
    this.socket = socket;
    this.options.onStatus?.('connecting');

    socket.onopen = () => {
      this.backoffMs = INITIAL_BACKOFF_MS;
      this.options.onStatus?.('open');
    };
    socket.onmessage = (message) => this.handleMessage(message.data);
    socket.onclose = (event) => {
      if (this.socket !== socket) return; // superseded by disconnect() or a newer socket
      this.socket = null;
      if (event.code === POLICY_VIOLATION) {
        this.stopped = true;
        this.options.onStatus?.('unauthorized');
        return;
      }
      this.options.onStatus?.('closed');
      this.scheduleReconnect();
    };
  }

  private handleMessage(raw: unknown): void {
    let message: WsMessage;
    try {
      message = JSON.parse(String(raw)) as WsMessage;
    } catch {
      return;
    }
    if (message.type !== 'event') return;

    const event = message.data as unknown as NotificationEvent;
    this.options.onEvent(event);
    if (message.message_id) this.send({ type: 'ack', message_id: message.message_id });
  }

  private send(payload: Record<string, unknown>): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(payload));
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    this.clearRetry();
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, this.options.maxBackoffMs ?? 30_000);
    this.retryTimer = setTimeout(() => this.open(), delay);
  }

  private clearRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }
}
