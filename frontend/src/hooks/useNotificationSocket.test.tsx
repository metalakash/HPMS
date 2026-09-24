import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { tokenResponse } from '@/test/fixtures';
import { useAuthStore } from '@/store/useAuthStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import type { NotificationSocketOptions } from '@/services/websocket';
import type { NotificationEvent } from '@/types/api';
import type * as HookModule from './useNotificationSocket';

const instances: {
  options: NotificationSocketOptions;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}[] = [];

vi.mock('@/services/websocket', () => ({
  NotificationSocket: class {
    connect = vi.fn();
    disconnect = vi.fn();
    constructor(public options: NotificationSocketOptions) {
      instances.push(this);
    }
  },
}));

const { useNotificationSocket } =
  await vi.importActual<typeof HookModule>('./useNotificationSocket');

function setup() {
  const queryClient = new QueryClient();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { invalidate, ...renderHook(() => useNotificationSocket(), { wrapper }) };
}

const event = (type: NotificationEvent['type']): NotificationEvent => ({
  id: `evt-${type}`,
  type,
  user_id: 'u-1',
  data: {},
  priority: 'medium',
  title: null,
  message: null,
  timestamp: '2026-09-24T00:00:00Z',
});

describe('useNotificationSocket', () => {
  it('does nothing while signed out', () => {
    instances.length = 0;
    setup();
    expect(instances).toHaveLength(0);
  });

  it('connects when signed in and disconnects on unmount', () => {
    instances.length = 0;
    useAuthStore.getState().setSession(tokenResponse);
    const { unmount } = setup();

    expect(instances).toHaveLength(1);
    expect(instances[0]!.connect).toHaveBeenCalled();
    unmount();
    expect(instances[0]!.disconnect).toHaveBeenCalled();
  });

  it('stores events and invalidates the affected queries', () => {
    instances.length = 0;
    useAuthStore.getState().setSession(tokenResponse);
    const { invalidate } = setup();
    const { onEvent } = instances[0]!.options;

    onEvent(event('rate_changed'));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['loans'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['projects'] });

    invalidate.mockClear();
    onEvent(event('export_completed'));
    expect(invalidate).not.toHaveBeenCalled();
    expect(useNotificationStore.getState().items.map((i) => i.type)).toEqual([
      'export_completed',
      'rate_changed',
    ]);
  });
});
