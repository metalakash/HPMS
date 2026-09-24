import { afterEach, describe, expect, it, vi } from 'vitest';
import { tokenResponse } from '@/test/fixtures';
import type { NotificationEvent } from '@/types/api';
import { getValidToken, isSessionValid, useAuthStore } from './useAuthStore';
import { useNotificationStore } from './useNotificationStore';

describe('useAuthStore', () => {
  afterEach(() => vi.useRealTimers());

  it('stores the session and derives expiry from expires_in_seconds', () => {
    vi.useFakeTimers({ now: 1_000_000 });
    useAuthStore.getState().setSession(tokenResponse);

    const state = useAuthStore.getState();
    expect(state.token).toBe('test-token');
    expect(state.user?.username).toBe('ram.sharma');
    expect(state.expiresAt).toBe(1_000_000 + 28_800_000);
    expect(getValidToken()).toBe('test-token');
  });

  it('treats an expired token as signed out', () => {
    vi.useFakeTimers({ now: 0 });
    useAuthStore.getState().setSession({ ...tokenResponse, expires_in_seconds: 60 });
    vi.setSystemTime(61_000);

    expect(isSessionValid(useAuthStore.getState())).toBe(false);
    expect(getValidToken()).toBeNull();
  });

  it('persists to sessionStorage, not localStorage', () => {
    useAuthStore.getState().setSession(tokenResponse);
    expect(sessionStorage.getItem('hpms-auth')).toContain('test-token');
    expect(localStorage.getItem('hpms-auth')).toBeNull();
  });

  it('clears everything on logout', () => {
    useAuthStore.getState().setSession(tokenResponse);
    useAuthStore.getState().logout();
    expect(useAuthStore.getState()).toMatchObject({ token: null, user: null, expiresAt: null });
  });
});

describe('useNotificationStore', () => {
  const event = (id: string): NotificationEvent => ({
    id,
    type: 'project_updated',
    user_id: 'u-1',
    data: {},
    priority: 'medium',
    title: `Event ${id}`,
    message: null,
    timestamp: '2026-09-24T00:00:00Z',
  });

  it('prepends events and counts unread', () => {
    const { push } = useNotificationStore.getState();
    push(event('a'));
    push(event('b'));
    const { items, unread } = useNotificationStore.getState();
    expect(items.map((i) => i.id)).toEqual(['b', 'a']);
    expect(unread).toBe(2);
  });

  it('ignores events replayed after a reconnect', () => {
    const { push } = useNotificationStore.getState();
    push(event('a'));
    push(event('a'));
    expect(useNotificationStore.getState().items).toHaveLength(1);
    expect(useNotificationStore.getState().unread).toBe(1);
  });

  it('keeps at most 50 events', () => {
    const { push } = useNotificationStore.getState();
    for (let i = 0; i < 60; i++) push(event(String(i)));
    const { items } = useNotificationStore.getState();
    expect(items).toHaveLength(50);
    expect(items[0]?.id).toBe('59');
  });

  it('marks all read', () => {
    useNotificationStore.getState().push(event('a'));
    useNotificationStore.getState().markAllRead();
    expect(useNotificationStore.getState().unread).toBe(0);
  });
});
