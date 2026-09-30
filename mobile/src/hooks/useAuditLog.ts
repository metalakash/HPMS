/**
 * useAuditLog Hook
 * Manage audit log operations and state
 */

import { useState, useCallback } from 'react';
import {
  auditAPI,
  SavedSearch,
} from '../services/audit-api';
import {
  auditService,
  AuditLog,
  AuditLogQuery,
  AuditStats,
  ActionType,
  Feature,
} from '../services/audit.service';

interface AuditFilters {
  dateRange?: { start: Date; end: Date };
  actionType?: ActionType | 'all';
  feature?: Feature | 'all';
  userId?: string;
  text?: string;
}

interface PaginationState {
  page: number;
  limit: number;
  total: number;
}

interface AuditLogState {
  logs: AuditLog[];
  selectedLog: AuditLog | null;
  filters: AuditFilters;
  searchResults: AuditLog[];
  stats: AuditStats | null;
  savedSearches: SavedSearch[];
  loading: boolean;
  error: string | null;
  pagination: PaginationState;
}

const initialState: AuditLogState = {
  logs: [],
  selectedLog: null,
  filters: {
    actionType: 'all',
    feature: 'all',
  },
  searchResults: [],
  stats: null,
  savedSearches: [],
  loading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 25,
    total: 0,
  },
};

export const useAuditLog = () => {
  const [state, setState] = useState<AuditLogState>(initialState);

  const loadLogs = useCallback(async (filters?: AuditFilters, page?: number) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const query: AuditLogQuery = {
        dateRange: filters?.dateRange,
        actionType: filters?.actionType,
        feature: filters?.feature,
        userId: filters?.userId,
        text: filters?.text,
        page: page || 1,
        limit: state.pagination.limit,
      };

      const result = await auditService.searchLogs(query);

      setState(prev => ({
        ...prev,
        logs: result.logs,
        pagination: {
          page: page || 1,
          limit: state.pagination.limit,
          total: result.total,
        },
        filters: filters || prev.filters,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load audit logs';
      setState(prev => ({ ...prev, error: message }));
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [state.pagination.limit]);

  const selectLog = useCallback(async (logId: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const log = await auditService.getLog(logId);
      setState(prev => ({
        ...prev,
        selectedLog: log,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load log details';
      setState(prev => ({ ...prev, error: message }));
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const updateFilters = useCallback(async (newFilters: Partial<AuditFilters>) => {
    const updatedFilters = { ...state.filters, ...newFilters };
    setState(prev => ({
      ...prev,
      filters: updatedFilters,
      pagination: { ...prev.pagination, page: 1 },
    }));
    await loadLogs(updatedFilters, 1);
  }, [state.filters, loadLogs]);

  const searchLogs = useCallback(async (query: string, filters?: AuditFilters) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await auditService.searchLogs({
        text: query,
        ...filters,
      });

      setState(prev => ({
        ...prev,
        searchResults: result.logs,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Search failed';
      setState(prev => ({ ...prev, error: message }));
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const exportLogs = useCallback(async (format: 'csv' | 'json' = 'csv') => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const blob = await auditService.exportLogs(state.filters, format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-logs.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      setState(prev => ({ ...prev, error: message }));
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [state.filters]);

  const loadStats = useCallback(async (dateRange?: { start: Date; end: Date }) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const stats = await auditService.getStats(dateRange);
      setState(prev => ({ ...prev, stats }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load statistics';
      setState(prev => ({ ...prev, error: message }));
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const loadSavedSearches = useCallback(async () => {
    try {
      const searches = await auditAPI.getSavedSearches();
      setState(prev => ({ ...prev, savedSearches: searches }));
    } catch (err) {
      console.error('Failed to load saved searches:', err);
    }
  }, []);

  const saveSavedSearch = useCallback(
    async (name: string, query: string, filters?: AuditFilters) => {
      try {
        const savedSearch = await auditAPI.saveSavedSearch({
          name,
          query,
          filters: {
            actionType: filters?.actionType,
            feature: filters?.feature,
            user: filters?.userId,
            dateRange: filters?.dateRange
              ? {
                  start: filters.dateRange.start.toISOString(),
                  end: filters.dateRange.end.toISOString(),
                }
              : undefined,
          },
        });

        setState(prev => ({
          ...prev,
          savedSearches: [savedSearch, ...prev.savedSearches],
        }));

        return savedSearch;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save search';
        setState(prev => ({ ...prev, error: message }));
        throw err;
      }
    },
    []
  );

  const applySavedSearch = useCallback(async (search: SavedSearch) => {
    const filters: AuditFilters = {
      actionType: search.filters.actionType,
      feature: search.filters.feature,
      userId: search.filters.user,
      dateRange: search.filters.dateRange
        ? {
            start: new Date(search.filters.dateRange.start),
            end: new Date(search.filters.dateRange.end),
          }
        : undefined,
    };

    await loadLogs(filters, 1);

    // Update last used
    try {
      await auditAPI.getSavedSearches();
    } catch (err) {
      console.error('Failed to update saved search:', err);
    }
  }, [loadLogs]);

  const deleteSavedSearch = useCallback(async (searchId: string) => {
    try {
      await auditAPI.deleteSavedSearch(searchId);
      setState(prev => ({
        ...prev,
        savedSearches: prev.savedSearches.filter(s => s.id !== searchId),
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete search';
      setState(prev => ({ ...prev, error: message }));
    }
  }, []);

  const rollbackLog = useCallback(async (logId: string, reason: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      await auditService.rollbackEvent(logId, reason);
      setState(prev => ({ ...prev, loading: false }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Rollback failed';
      setState(prev => ({ ...prev, error: message, loading: false }));
    }
  }, []);

  const getUserHistory = useCallback(async (userId: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const logs = await auditService.getUserLogs(userId);
      setState(prev => ({
        ...prev,
        logs,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load user history';
      setState(prev => ({ ...prev, error: message }));
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const getRecordHistory = useCallback(async (recordId: string, feature: Feature) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const logs = await auditService.getRecordHistory(recordId, feature);
      setState(prev => ({
        ...prev,
        logs,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load record history';
      setState(prev => ({ ...prev, error: message }));
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const resetState = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    // State
    logs: state.logs,
    selectedLog: state.selectedLog,
    filters: state.filters,
    searchResults: state.searchResults,
    stats: state.stats,
    savedSearches: state.savedSearches,
    loading: state.loading,
    error: state.error,
    pagination: state.pagination,

    // Methods
    loadLogs,
    selectLog,
    updateFilters,
    searchLogs,
    exportLogs,
    loadStats,
    loadSavedSearches,
    saveSavedSearch,
    applySavedSearch,
    deleteSavedSearch,
    rollbackLog,
    getUserHistory,
    getRecordHistory,
    clearError,
    resetState,
  };
};
