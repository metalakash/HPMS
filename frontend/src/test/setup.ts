import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { useAuthStore } from '@/store/useAuthStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useUIStore } from '@/store/useUIStore';
import { server } from './server';

// The app shell opens a real notifications socket; page tests don't want one.
// useNotificationSocket.test.ts opts back in with vi.importActual.
vi.mock('@/hooks/useNotificationSocket', () => ({ useNotificationSocket: () => undefined }));

// jsdom has no matchMedia; the theme hook needs it.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const initialAuth = useAuthStore.getState();
const initialUI = useUIStore.getState();
const initialNotifications = useNotificationStore.getState();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  useAuthStore.setState(initialAuth, true);
  useUIStore.setState(initialUI, true);
  useNotificationStore.setState(initialNotifications, true);
  sessionStorage.clear();
  localStorage.clear();
});
afterAll(() => server.close());
