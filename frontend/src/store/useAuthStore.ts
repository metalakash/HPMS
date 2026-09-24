import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AuthUser, TokenResponse } from '@/types/api';

interface AuthState {
  token: string | null;
  expiresAt: number | null;
  user: AuthUser | null;
  setSession: (response: TokenResponse) => void;
  logout: () => void;
}

/**
 * The backend issues a bearer JWT (8h) with no refresh or cookie flow. It is
 * kept in sessionStorage so it is scoped to the tab and gone when the tab closes.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      expiresAt: null,
      user: null,
      setSession: ({ access_token, expires_in_seconds, user }) =>
        set({
          token: access_token,
          expiresAt: Date.now() + expires_in_seconds * 1000,
          user,
        }),
      logout: () => set({ token: null, expiresAt: null, user: null }),
    }),
    { name: 'hpms-auth', storage: createJSONStorage(() => sessionStorage) },
  ),
);

export function isSessionValid(state: Pick<AuthState, 'token' | 'expiresAt'>): boolean {
  return Boolean(state.token && state.expiresAt && state.expiresAt > Date.now());
}

/** Token for non-React callers (API interceptors, WebSocket); null once expired. */
export function getValidToken(): string | null {
  const state = useAuthStore.getState();
  return isSessionValid(state) ? state.token : null;
}
