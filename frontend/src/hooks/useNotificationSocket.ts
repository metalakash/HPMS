import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { NotificationSocket } from '@/services/websocket';
import { getValidToken, useAuthStore } from '@/store/useAuthStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import type { NotificationEventType } from '@/types/api';
import { queryKeys } from './queries';

/** Which cached queries go stale when a given server event arrives. */
const INVALIDATES: Partial<Record<NotificationEventType, readonly (readonly string[])[]>> = {
  project_updated: [queryKeys.projects],
  loan_updated: [queryKeys.loans, queryKeys.projects],
  rate_changed: [queryKeys.loans, queryKeys.projects],
};

/** Keeps one notifications socket open while signed in; mount once in the app shell. */
export function useNotificationSocket() {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) return;
    const { push, setStatus } = useNotificationStore.getState();

    const socket = new NotificationSocket({
      getToken: getValidToken,
      onStatus: setStatus,
      onEvent: (event) => {
        push(event);
        for (const queryKey of INVALIDATES[event.type] ?? []) {
          void queryClient.invalidateQueries({ queryKey });
        }
      },
    });
    socket.connect();
    return () => socket.disconnect();
  }, [token, queryClient]);
}
