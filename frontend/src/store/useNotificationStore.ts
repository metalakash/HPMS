import { create } from 'zustand';
import type { NotificationEvent } from '@/types/api';

export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'unauthorized';

const MAX_NOTIFICATIONS = 50;

interface NotificationState {
  status: ConnectionStatus;
  items: NotificationEvent[];
  unread: number;
  setStatus: (status: ConnectionStatus) => void;
  push: (event: NotificationEvent) => void;
  markAllRead: () => void;
  clear: () => void;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  status: 'idle',
  items: [],
  unread: 0,
  setStatus: (status) => set({ status }),
  push: (event) =>
    set((state) => {
      // Pending events are replayed on reconnect, so the same id can arrive twice.
      if (state.items.some((item) => item.id === event.id)) return state;
      return {
        items: [event, ...state.items].slice(0, MAX_NOTIFICATIONS),
        unread: state.unread + 1,
      };
    }),
  markAllRead: () => set({ unread: 0 }),
  clear: () => set({ items: [], unread: 0 }),
}));
