/**
 * useWebSocket - Custom hook for WebSocket integration
 */

import { useEffect, useCallback, useState } from 'react';
import {
  websocketService,
  WebSocketMessage,
  ProjectUpdate,
} from '@/services/websocket.service';

interface UseWebSocketOptions {
  autoConnect?: boolean;
  events?: string[];
}

interface UseWebSocketResult {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  subscribe: (eventKey: string, handler: (msg: WebSocketMessage) => void) => () => void;
}

/**
 * Hook for WebSocket connection management
 */
export function useWebSocket(
  options: UseWebSocketOptions = {}
): UseWebSocketResult {
  const { autoConnect = true, events = [] } = options;
  const [isConnected, setIsConnected] = useState(
    websocketService.isConnected()
  );
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    try {
      setError(null);
      await websocketService.connect();
      setIsConnected(true);
    } catch (err: any) {
      setError(err.message);
      setIsConnected(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    websocketService.disconnect();
    setIsConnected(false);
  }, []);

  const subscribe = useCallback(
    (eventKey: string, handler: (msg: WebSocketMessage) => void) => {
      return websocketService.subscribe(eventKey, (message) => {
        setLastMessage(message);
        handler(message);
      });
    },
    []
  );

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && !isConnected) {
      connect();
    }

    return () => {
      // Don't disconnect on unmount - keep connection alive
    };
  }, [autoConnect, connect, isConnected]);

  return {
    isConnected,
    lastMessage,
    error,
    connect,
    disconnect,
    subscribe,
  };
}

/**
 * Hook for listening to real-time project updates
 */
export function useProjectUpdates(callback: (update: ProjectUpdate) => void) {
  const { subscribe } = useWebSocket({ autoConnect: true });

  useEffect(() => {
    const unsubscribe = subscribe('project:*', (message) => {
      if (message.entity === 'project') {
        callback(message as ProjectUpdate);
      }
    });

    return unsubscribe;
  }, [subscribe, callback]);
}

/**
 * Hook for listening to notifications
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const { subscribe } = useWebSocket({ autoConnect: true });

  useEffect(() => {
    const unsubscribe = subscribe('notification:*', (message) => {
      if (message.entity === 'notification') {
        setNotifications(prev => [message.data, ...prev].slice(0, 50));
      }
    });

    return unsubscribe;
  }, [subscribe]);

  return notifications;
}

/**
 * Hook for listening to all real-time events
 */
export function useRealtimeEvents(
  onEvent: (message: WebSocketMessage) => void
) {
  const { subscribe } = useWebSocket({ autoConnect: true });

  useEffect(() => {
    const unsubscribe = subscribe('*', onEvent);
    return unsubscribe;
  }, [subscribe, onEvent]);
}
