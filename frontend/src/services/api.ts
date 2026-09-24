import axios, { AxiosError } from 'axios';
import { API_BASE_URL } from '@/config';
import { getValidToken, useAuthStore } from '@/store/useAuthStore';
import { useUIStore } from '@/store/useUIStore';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getValidToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['Accept-Language'] = useUIStore.getState().language;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    // An expired or revoked token: drop the session so ProtectedRoute sends the user to login.
    if (error instanceof AxiosError && error.response?.status === 401) {
      const isLogin = error.config?.url?.endsWith('/auth/login');
      if (!isLogin) useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);

/** FastAPI errors carry `detail` as a string or a list of validation errors. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const detail: unknown = error.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: string };
      if (first.msg) return first.msg;
    }
    if (!error.response) return 'Cannot reach the HPMS server. Check your connection.';
    // What the dev proxy or nginx return when the backend itself is down.
    if ([502, 503, 504].includes(error.response.status)) {
      return 'The HPMS server is unavailable. Try again shortly.';
    }
    return `Request failed (${error.response.status})`;
  }
  return error instanceof Error ? error.message : 'Something went wrong';
}
