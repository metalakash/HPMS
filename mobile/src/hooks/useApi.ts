/**
 * useApi - Custom hook for API calls with loading and error states
 */

import { useState, useCallback } from 'react';
import { apiService } from '@/services/api.service';
import { ApiError, getErrorMessage } from '@/utils/api-error.util';
import useAppStore from '@/store/app.store';

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: () => Promise<T | null>;
  retry: () => Promise<T | null>;
  clear: () => void;
}

/**
 * Hook for API calls with loading and error handling
 */
export function useApi<T>(
  apiFunction: () => Promise<T>,
  options: { autoExecute?: boolean } = {}
): UseApiResult<T> {
  const { autoExecute = true } = options;
  const { setOnline } = useAppStore();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(autoExecute);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiFunction();
      setData(result);
      setOnline(true); // Connection successful
      return result;
    } catch (err: any) {
      const apiError = err instanceof ApiError ? err : new ApiError(0, err.message, null, true);
      const errorMessage = getErrorMessage(apiError);
      setError(errorMessage);

      // Mark as offline if network error
      if (apiError.isNetworkError) {
        setOnline(false);
      }

      return null;
    } finally {
      setLoading(false);
    }
  }, [apiFunction, setOnline]);

  const retry = useCallback(execute, [execute]);

  const clear = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  // Auto-execute on mount if enabled
  React.useEffect(() => {
    if (autoExecute) {
      execute();
    }
  }, [autoExecute, execute]);

  return {
    data,
    loading,
    error,
    execute,
    retry,
    clear,
  };
}

/**
 * Hook for pagination API calls
 */
interface UsePaginatedApiOptions {
  pageSize?: number;
  autoExecute?: boolean;
}

interface UsePaginatedApiResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  page: number;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  retry: () => Promise<void>;
}

export function usePaginatedApi<T>(
  apiFunction: (page: number) => Promise<T[]>,
  options: UsePaginatedApiOptions = {}
): UsePaginatedApiResult<T> {
  const { pageSize = 10, autoExecute = true } = options;
  const { setOnline } = useAppStore();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(autoExecute);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchPage = useCallback(
    async (pageNum: number) => {
      setLoading(true);
      setError(null);

      try {
        const result = await apiFunction(pageNum);
        setData(pageNum === 1 ? result : [...data, ...result]);
        setPage(pageNum);
        setHasMore(result.length === pageSize);
        setOnline(true);
        return result;
      } catch (err: any) {
        const apiError = err instanceof ApiError ? err : new ApiError(0, err.message, null, true);
        const errorMessage = getErrorMessage(apiError);
        setError(errorMessage);

        if (apiError.isNetworkError) {
          setOnline(false);
        }

        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiFunction, data, pageSize, setOnline]
  );

  const loadMore = useCallback(async () => {
    if (hasMore && !loading) {
      await fetchPage(page + 1);
    }
  }, [hasMore, loading, page, fetchPage]);

  const refresh = useCallback(async () => {
    setPage(1);
    await fetchPage(1);
  }, [fetchPage]);

  const retry = useCallback(refresh, [refresh]);

  // Initial load
  React.useEffect(() => {
    if (autoExecute) {
      fetchPage(1);
    }
  }, [autoExecute, fetchPage]);

  return {
    data,
    loading,
    error,
    page,
    hasMore,
    loadMore,
    refresh,
    retry,
  };
}
