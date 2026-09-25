/** Empty means same-origin: the Vite dev proxy locally, nginx in production. */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '';

export function websocketUrl(path: string): string {
  const base = API_BASE_URL ? new URL(API_BASE_URL) : window.location;
  const protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${base.host}${path}`;
}
