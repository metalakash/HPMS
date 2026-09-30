/**
 * usePortfolioData - Custom hook for portfolio metrics and projects
 */

import { useState, useCallback } from 'react';
import { apiService } from '@/services/api.service';

interface UsePortfolioDataResult {
  loading: boolean;
  error: string | null;
  metrics: any | null;
  projects: any[];
  refreshMetrics: () => Promise<void>;
  fetchProjects: (page: number) => Promise<void>;
  retry: () => Promise<void>;
}

export const usePortfolioData = (): UsePortfolioDataResult => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState(null);
  const [projects, setProjects] = useState<any[]>([]);

  const refreshMetrics = useCallback(async () => {
    try {
      setError(null);
      const data = await apiService.getPortfolioMetrics();
      setMetrics(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load metrics');
      console.error('Error fetching metrics:', err);
    }
  }, []);

  const fetchProjects = useCallback(
    async (page: number = 1) => {
      try {
        setError(null);
        const data = await apiService.getProjects(page);
        setProjects(page === 1 ? data : [...projects, ...data]);
      } catch (err: any) {
        setError(err.message || 'Failed to load projects');
        console.error('Error fetching projects:', err);
      }
    },
    [projects]
  );

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await Promise.all([
        refreshMetrics(),
        fetchProjects(1),
      ]);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [refreshMetrics, fetchProjects]);

  const retry = useCallback(async () => {
    await loadInitialData();
  }, [loadInitialData]);

  return {
    loading,
    error,
    metrics,
    projects,
    refreshMetrics,
    fetchProjects,
    retry,
  };
};
