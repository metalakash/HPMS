import { render } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from '@/App';
import { routes } from '@/router';
import { useAuthStore } from '@/store/useAuthStore';
import { tokenResponse } from './fixtures';
import type { AuthUser } from '@/types/api';

export function signIn(user: Partial<AuthUser> = {}) {
  useAuthStore
    .getState()
    .setSession({ ...tokenResponse, user: { ...tokenResponse.user, ...user } });
}

/** Renders the real route table at `path` with a fresh, non-retrying query client. */
export function renderRoute(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...utils, router, queryClient };
}
