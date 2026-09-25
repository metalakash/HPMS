import { QueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Client errors (401/403/404/422) won't fix themselves; only retry network/5xx.
        retry: (failureCount, error) => {
          const status = error instanceof AxiosError ? error.response?.status : undefined;
          if (status && status < 500) return false;
          return failureCount < 2;
        },
      },
    },
  });
}
