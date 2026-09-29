/**
 * Custom React Hooks for Search & Filtering
 * Provides search, filters, saved filters, and history management
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  searchService,
  SearchResult,
  SearchHistoryItem,
} from '../services/search.service';
import { filterService, Filter, FilterOption, FilterPreset } from '../services/filter.service';
import { savedFilterService, SavedFilter } from '../services/saved-filter.service';

// ==================== useSearch ====================

export const useSearch = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const performSearch = useCallback(async (searchQuery: string, features?: string[]) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await searchService.search(searchQuery, features);
      if (isMounted.current) {
        setResults(data);
        setQuery(searchQuery);
      }
    } catch (err) {
      if (isMounted.current) {
        setError((err as Error).message);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  return {
    query,
    results,
    loading,
    error,
    performSearch,
    setQuery,
    clearResults: () => setResults([]),
  };
};

// ==================== useSearchHistory ====================

export const useSearchHistory = () => {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const isMounted = useRef(true);

  const loadHistory = useCallback(async () => {
    setLoading(true);

    try {
      const data = await searchService.getSearchHistory();
      if (isMounted.current) {
        setHistory(data);
      }
    } catch (error) {
      console.error('Error loading search history:', error);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadHistory();

    return () => {
      isMounted.current = false;
    };
  }, [loadHistory]);

  const deleteItem = useCallback(async (id: string) => {
    try {
      await searchService.deleteHistoryItem(id);
      setHistory(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error('Error deleting history item:', error);
    }
  }, []);

  const clearHistory = useCallback(async () => {
    try {
      await searchService.clearHistory();
      setHistory([]);
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  }, []);

  const exportHistory = useCallback(async () => {
    try {
      return await searchService.exportHistory();
    } catch (error) {
      console.error('Error exporting history:', error);
      throw error;
    }
  }, []);

  return {
    history,
    loading,
    deleteItem,
    clearHistory,
    exportHistory,
    refetch: loadHistory,
  };
};

// ==================== useFilters ====================

export const useFilters = (feature: string) => {
  const [availableFilters, setAvailableFilters] = useState<FilterOption[]>([]);
  const [appliedFilters, setAppliedFilters] = useState<Filter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const loadAvailableFilters = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await filterService.getAvailableFilters(feature);
      if (isMounted.current) {
        setAvailableFilters(data);
      }
    } catch (err) {
      if (isMounted.current) {
        setError((err as Error).message);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [feature]);

  useEffect(() => {
    loadAvailableFilters();

    return () => {
      isMounted.current = false;
    };
  }, [loadAvailableFilters]);

  const addFilter = useCallback((filter: Filter) => {
    setAppliedFilters(prev => [...prev, filter]);
  }, []);

  const removeFilter = useCallback((id: string | number) => {
    setAppliedFilters(prev => prev.filter((_, idx) => (filter?.id || idx) !== id));
  }, []);

  const updateFilter = useCallback((id: string | number, updates: Partial<Filter>) => {
    setAppliedFilters(prev =>
      prev.map(f => ((f.id || prev.indexOf(f)) === id ? { ...f, ...updates } : f))
    );
  }, []);

  const clearFilters = useCallback(() => {
    setAppliedFilters([]);
  }, []);

  const applyFilters = useCallback(async () => {
    try {
      const validation = filterService.validateFilters(appliedFilters);
      if (!validation.valid) {
        throw new Error('Invalid filters');
      }
      return await filterService.applyFilters(feature, appliedFilters);
    } catch (err) {
      console.error('Error applying filters:', err);
      throw err;
    }
  }, [feature, appliedFilters]);

  return {
    availableFilters,
    appliedFilters,
    loading,
    error,
    addFilter,
    removeFilter,
    updateFilter,
    clearFilters,
    applyFilters,
    refetch: loadAvailableFilters,
  };
};

// ==================== useSavedFilters ====================

export const useSavedFilters = (feature?: string) => {
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const loadSavedFilters = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await savedFilterService.getSavedFilters(feature);
      if (isMounted.current) {
        setSavedFilters(data);
      }
    } catch (err) {
      if (isMounted.current) {
        setError((err as Error).message);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [feature]);

  useEffect(() => {
    loadSavedFilters();

    return () => {
      isMounted.current = false;
    };
  }, [loadSavedFilters]);

  const createFilter = useCallback(
    async (filter: Omit<SavedFilter, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>) => {
      try {
        const newFilter = await savedFilterService.createSavedFilter(filter);
        setSavedFilters(prev => [...prev, newFilter]);
        return newFilter;
      } catch (err) {
        console.error('Error creating filter:', err);
        throw err;
      }
    },
    []
  );

  const updateFilter = useCallback(async (id: string, updates: Partial<SavedFilter>) => {
    try {
      const updated = await savedFilterService.updateSavedFilter(id, updates);
      setSavedFilters(prev => prev.map(f => (f.id === id ? updated : f)));
      return updated;
    } catch (err) {
      console.error('Error updating filter:', err);
      throw err;
    }
  }, []);

  const deleteFilter = useCallback(async (id: string) => {
    try {
      await savedFilterService.deleteSavedFilter(id);
      setSavedFilters(prev => prev.filter(f => f.id !== id));
    } catch (err) {
      console.error('Error deleting filter:', err);
      throw err;
    }
  }, []);

  const shareFilter = useCallback(async (id: string, teamMembers: string[]) => {
    try {
      const updated = await savedFilterService.shareFilter(id, teamMembers);
      setSavedFilters(prev => prev.map(f => (f.id === id ? updated : f)));
      return updated;
    } catch (err) {
      console.error('Error sharing filter:', err);
      throw err;
    }
  }, []);

  const setDefaultFilter = useCallback(async (id: string | null) => {
    try {
      await savedFilterService.setDefaultFilter(id);
    } catch (err) {
      console.error('Error setting default filter:', err);
      throw err;
    }
  }, []);

  return {
    savedFilters,
    loading,
    error,
    createFilter,
    updateFilter,
    deleteFilter,
    shareFilter,
    setDefaultFilter,
    refetch: loadSavedFilters,
  };
};

// ==================== useFilterPresets ====================

export const useFilterPresets = (feature: string) => {
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [loading, setLoading] = useState(false);
  const isMounted = useRef(true);

  const loadPresets = useCallback(async () => {
    setLoading(true);

    try {
      const data = await filterService.getFilterPresets(feature);
      if (isMounted.current) {
        setPresets(data);
      }
    } catch (error) {
      console.error('Error loading presets:', error);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [feature]);

  useEffect(() => {
    loadPresets();

    return () => {
      isMounted.current = false;
    };
  }, [loadPresets]);

  return {
    presets,
    loading,
    refetch: loadPresets,
  };
};

// ==================== useSearchSuggestions ====================

export const useSearchSuggestions = (query: string) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);

    const fetchSuggestions = async () => {
      try {
        const data = await searchService.getSearchSuggestions(query);
        if (isMounted.current) {
          setSuggestions(data);
        }
      } catch (error) {
        console.error('Error fetching suggestions:', error);
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    };

    const timer = setTimeout(fetchSuggestions, 300); // Debounce

    return () => {
      clearTimeout(timer);
      isMounted.current = false;
    };
  }, [query]);

  return { suggestions, loading };
};

// ==================== useSearchAnalytics ====================

export const useSearchAnalytics = () => {
  const [stats, setStats] = useState({
    totalSearches: 0,
    averageResults: 0,
    uniqueQueries: 0,
    topQueries: [] as string[],
  });

  useEffect(() => {
    const updateStats = () => {
      const newStats = searchService.getHistoryStats();
      setStats(newStats);
    };

    updateStats();
  }, []);

  return stats;
};
