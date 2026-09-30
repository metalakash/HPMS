/**
 * WebSocket Service - Real-time updates via WebSocket
 */

import useAppStore from '@/store/app.store';
import { cacheService } from './cache.service';
import * as endpoints from './endpoints';

export interface WebSocketMessage {
  type: string;
  entity: string;
  action: string;
  data: any;
  timestamp: number;
}

export interface ProjectUpdate extends WebSocketMessage {
  entity: 'project';
  data: {
    id: string;
    name: string;
    status: string;
    progress?: number;
    capacityMw?: number;
  };
}

export interface InspectionUpdate extends WebSocketMessage {
  entity: 'inspection';
  data: {
    id: string;
    projectId: string;
    status: string;
    timestamp: number;
  };
}

export interface NotificationMessage extends WebSocketMessage {
  entity: 'notification';
  data: {
    id: string;
    title: string;
    message: string;
    level: 'info' | 'warning' | 'error';
    read: boolean;
  };
}

type EventHandler = (message: WebSocketMessage) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: Map<string, EventHandler[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isIntentionallyClosed = false;

  constructor() {
    const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    this.url = baseUrl.replace('http', 'ws') + '/api/v1/ws';
  }

  /**
   * Connect to WebSocket
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const token = useAppStore.getState().token;
        if (!token) {
          reject(new Error('No authentication token'));
          return;
        }

        this.isIntentionallyClosed = false;
        this.ws = new WebSocket(`${this.url}?token=${token}`);

        this.ws.onopen = () => {
          console.log('[WebSocket] Connected');
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          useAppStore.getState().setOnline(true);
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error('[WebSocket] Error:', error);
          useAppStore.getState().setOnline(false);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('[WebSocket] Disconnected');
          this.stopHeartbeat();
          if (!this.isIntentionallyClosed) {
            this.reconnect();
          }
        };
      } catch (error) {
        console.error('[WebSocket] Connection failed:', error);
        reject(error);
      }
    });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: string) {
    try {
      const message: WebSocketMessage = JSON.parse(data);
      console.log('[WebSocket] Message:', message);

      // Trigger handlers for this entity type
      const key = `${message.entity}:${message.action}`;
      const handlers = this.handlers.get(key) || [];
      handlers.forEach(handler => handler(message));

      // Trigger wildcard handlers
      const wildcardHandlers = this.handlers.get(`${message.entity}:*`) || [];
      wildcardHandlers.forEach(handler => handler(message));

      // Global handlers
      const globalHandlers = this.handlers.get('*') || [];
      globalHandlers.forEach(handler => handler(message));

      // Invalidate relevant cache
      this.invalidateCache(message);
    } catch (error) {
      console.error('[WebSocket] Failed to parse message:', error);
    }
  }

  /**
   * Subscribe to events
   */
  subscribe(eventKey: string, handler: EventHandler): () => void {
    if (!this.handlers.has(eventKey)) {
      this.handlers.set(eventKey, []);
    }
    this.handlers.get(eventKey)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(eventKey) || [];
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    };
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(eventKey: string, handler: EventHandler) {
    const handlers = this.handlers.get(eventKey) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }

  /**
   * Invalidate cache based on message
   */
  private invalidateCache(message: WebSocketMessage) {
    switch (message.entity) {
      case 'project':
        // Invalidate project-related caches
        cacheService.remove(endpoints.CACHE_KEYS.portfolio);
        cacheService.remove(endpoints.CACHE_KEYS.projects(1));
        if (message.data?.id) {
          cacheService.remove(endpoints.CACHE_KEYS.project(message.data.id));
          cacheService.remove(
            endpoints.CACHE_KEYS.analytics(message.data.id)
          );
        }
        break;

      case 'inspection':
        // Invalidate inspection caches
        if (message.data?.projectId) {
          cacheService.remove(
            endpoints.CACHE_KEYS.inspections(message.data.projectId)
          );
        }
        break;

      case 'maintenance':
        // Invalidate maintenance caches
        if (message.data?.projectId) {
          cacheService.remove(
            endpoints.CACHE_KEYS.maintenance(message.data.projectId)
          );
        }
        break;

      case 'notification':
        // Notifications handled by store
        break;
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Reconnect with exponential backoff
   */
  private reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnect attempts reached');
      useAppStore.getState().setOnline(false);
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(
      `[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`
    );

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        console.error('[WebSocket] Reconnect failed:', error);
      });
    }, delay);
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    this.isIntentionallyClosed = true;
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    console.log('[WebSocket] Disconnected');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Send message
   */
  send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] Not connected, cannot send message');
    }
  }
}

export const websocketService = new WebSocketService();
