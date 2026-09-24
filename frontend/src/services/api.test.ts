import { AxiosError, AxiosHeaders } from 'axios';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/server';
import { tokenResponse } from '@/test/fixtures';
import { useAuthStore } from '@/store/useAuthStore';
import { useUIStore } from '@/store/useUIStore';
import { api, getErrorMessage } from './api';
import { authApi, projectsApi } from './endpoints';

describe('api client', () => {
  it('sends the bearer token and language on every request', async () => {
    let headers: Headers | undefined;
    server.use(
      http.get('*/api/v1/projects', ({ request }) => {
        headers = request.headers;
        return HttpResponse.json({ data: [], meta: {}, audit: {} });
      }),
    );
    useAuthStore.getState().setSession(tokenResponse);
    useUIStore.getState().setLanguage('ne');

    await projectsApi.list();

    expect(headers?.get('authorization')).toBe('Bearer test-token');
    expect(headers?.get('accept-language')).toBe('ne');
  });

  it('omits Authorization when signed out', async () => {
    let auth: string | null = 'unset';
    server.use(
      http.get('*/api/v1/projects', ({ request }) => {
        auth = request.headers.get('authorization');
        return HttpResponse.json({ data: [], meta: {}, audit: {} });
      }),
    );
    await projectsApi.list();
    expect(auth).toBeNull();
  });

  it('drops empty filters from the query string', async () => {
    let search = '';
    server.use(
      http.get('*/api/v1/projects', ({ request }) => {
        search = new URL(request.url).search;
        return HttpResponse.json({ data: [], meta: {}, audit: {} });
      }),
    );
    await projectsApi.list({ stage: 'operation', status: '', province: undefined, page: 2 });
    expect(new URLSearchParams(search).toString()).toBe('stage=operation&page=2');
  });

  it('logs out when an authenticated request returns 401', async () => {
    server.use(
      http.get('*/api/v1/projects', () =>
        HttpResponse.json({ detail: 'Invalid or expired token' }, { status: 401 }),
      ),
    );
    useAuthStore.getState().setSession(tokenResponse);

    await expect(projectsApi.list()).rejects.toBeInstanceOf(AxiosError);
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('does not clear an existing session on a failed login attempt', async () => {
    useAuthStore.getState().setSession(tokenResponse);
    await expect(authApi.login({ username: 'x', password: 'wrong' })).rejects.toBeInstanceOf(
      AxiosError,
    );
    expect(useAuthStore.getState().token).toBe('test-token');
  });

  it('uses a same-origin base URL by default', () => {
    expect(api.defaults.baseURL).toBe('');
  });
});

describe('getErrorMessage', () => {
  const axiosError = (status: number | null, data?: unknown) => {
    const config = { headers: new AxiosHeaders() };
    return new AxiosError(
      'failed',
      'ERR',
      config,
      null,
      status === null ? undefined : { status, statusText: '', data, headers: {}, config },
    );
  };

  it('reads a FastAPI string detail', () => {
    expect(getErrorMessage(axiosError(401, { detail: 'Invalid username or password' }))).toBe(
      'Invalid username or password',
    );
  });

  it('reads the first validation error', () => {
    expect(getErrorMessage(axiosError(422, { detail: [{ msg: 'field required' }] }))).toBe(
      'field required',
    );
  });

  it('explains network failures and bare status codes', () => {
    expect(getErrorMessage(axiosError(null))).toMatch(/Cannot reach the HPMS server/);
    expect(getErrorMessage(axiosError(418, {}))).toBe('Request failed (418)');
    expect(getErrorMessage(axiosError(502, {}))).toMatch(/server is unavailable/);
  });

  it('falls back for non-axios errors', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
    expect(getErrorMessage('??')).toBe('Something went wrong');
  });
});
