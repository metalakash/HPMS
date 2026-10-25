/** The hosted demo's "reset demo data" action. Offered only where the backend has it switched on. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export interface DemoResetResult {
  projects: number;
  change_requests: number;
  duration_seconds: number;
}

export const demoResetApi = {
  status: () => api.get<{ enabled: boolean }>('/api/v1/admin/demo-reset').then((r) => r.data.enabled),
  reset: () =>
    // Reseeding takes a while on the free hosting tier
    api.post<{ data: DemoResetResult }>('/api/v1/admin/demo-reset', undefined, { timeout: 180_000 }).then((r) => r.data.data),
};

export function useDemoResetEnabled() {
  return useQuery({ queryKey: ['admin', 'demo-reset'], queryFn: demoResetApi.status, staleTime: Infinity });
}

export function useResetDemoData() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: demoResetApi.reset,
    // Every screen's data has changed
    onSuccess: () => client.invalidateQueries(),
  });
}
