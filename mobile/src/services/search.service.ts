/**
 * Search Service
 * API integration for full-text search across all features
 */

import { api } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SEARCH_HISTORY_KEY = 'search_history';
const SEARCH_CACHE_KEY = 'search_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_HISTORY_ITEMS = 20;

export interface SearchResult {
  id: string;
  type: 'inspection' | 'maintenance' | 'document' | 'covenant' | 'analytics';
  title: string;
  snippet: string;
  matchedFields: string[];
  metadata: Record<string, any>;
  relevanceScore: number;
  featureId: string;
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  resultCount: number;
  timestamp: string;
  features: string[];
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class SearchServiceClass {
  private searchCache: Map<string, CacheEntry<SearchResult[]>> = new Map();
  private suggestionsCache: Map<string, CacheEntry<string[]>> = new Map();
  private history: SearchHistoryItem[] = [];

  constructor() {
    this.loadHistory();
  }

  // ==================== Full-Text Search ====================

  async search(
    query: string,
    features?: string[],
    page: number = 1
  ): Promise<SearchResult[]> {
    if (!query.trim()) {
      return [];
    }

    const cacheKey = `${query}:${features?.join(',') || 'all'}:${page}`;

    try {
      // Check cache
      const cached = this.searchCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
      }

      // API call
      const response = await api.post('/search', {
        query,
        features: features || [],
        page,
        limit: 50,
      });

      const results = response.data || [];

      // Update cache
      this.searchCache.set(cacheKey, {
        data: results,
        timestamp: Date.now(),
      });

      // Add to history
      await this.addToHistory(query, results.length, features);

      return results;
    } catch (error) {
      console.error('Error searching:', error);
      throw error;
    }
  }

  // ==================== Feature-Specific Search ====================

  async searchInspections(query: string): Promise<SearchResult[]> {
    try {
      const response = await api.get(`/inspections/search?q=${encodeURIComponent(query)}`);
      return response.data || [];
    } catch (error) {
      console.error('Error searching inspections:', error);
      return [];
    }
  }

  async searchWorkOrders(query: string): Promise<SearchResult[]> {
    try {
      const response = await api.get(`/work-orders/search?q=${encodeURIComponent(query)}`);
      return response.data || [];
    } catch (error) {
      console.error('Error searching work orders:', error);
      return [];
    }
  }

  async searchDocuments(query: string): Promise<SearchResult[]> {
    try {
      const response = await api.get(`/documents/search?q=${encodeURIComponent(query)}`);
      return response.data || [];
    } catch (error) {
      console.error('Error searching documents:', error);
      return [];
    }
  }

  async searchCovenants(query: string): Promise<SearchResult[]> {
    try {
      const response = await api.get(`/covenants/search?q=${encodeURIComponent(query)}`);
      return response.data || [];
    } catch (error) {
      console.error('Error searching covenants:', error);
      return [];
    }
  }

  // ==================== Suggestions ====================

  async getSearchSuggestions(query: string): Promise<string[]> {
    if (query.length < 2) {
      return [];
    }

    const cacheKey = query.toLowerCase();

    try {
      // Check cache
      const cached = this.suggestionsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
      }

      // API call
      const response = await api.get(
        `/search/suggestions?q=${encodeURIComponent(query)}`
      );

      const suggestions = response.data || [];

      // Update cache
      this.suggestionsCache.set(cacheKey, {
        data: suggestions,
        timestamp: Date.now(),
      });

      return suggestions;
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      return [];
    }
  }

  // ==================== Search History ====================

  async getSearchHistory(): Promise<SearchHistoryItem[]> {
    return this.history;
  }

  private async addToHistory(
    query: string,
    resultCount: number,
    features?: string[]
  ): Promise<void> {
    try {
      const item: SearchHistoryItem = {
        id: `search-${Date.now()}`,
        query,
        resultCount,
        timestamp: new Date().toISOString(),
        features: features || [],
      };

      // Add to beginning of history
      this.history.unshift(item);

      // Limit history size
      if (this.history.length > MAX_HISTORY_ITEMS) {
        this.history = this.history.slice(0, MAX_HISTORY_ITEMS);
      }

      // Persist to AsyncStorage
      await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(this.history));
    } catch (error) {
      console.error('Error adding to search history:', error);
    }
  }

  async deleteHistoryItem(id: string): Promise<void> {
    try {
      this.history = this.history.filter(item => item.id !== id);
      await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(this.history));
    } catch (error) {
      console.error('Error deleting history item:', error);
      throw error;
    }
  }

  async clearHistory(): Promise<void> {
    try {
      this.history = [];
      await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch (error) {
      console.error('Error clearing history:', error);
      throw error;
    }
  }

  private async loadHistory(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
      if (stored) {
        this.history = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading search history:', error);
      this.history = [];
    }
  }

  // ==================== Search Analytics ====================

  getHistoryStats() {
    if (this.history.length === 0) {
      return {
        totalSearches: 0,
        averageResults: 0,
        uniqueQueries: 0,
        topQueries: [],
      };
    }

    const uniqueQueries = new Set(this.history.map(h => h.query));
    const totalResults = this.history.reduce((sum, h) => sum + h.resultCount, 0);

    // Get top 5 queries by result count
    const topQueries = [...this.history]
      .sort((a, b) => b.resultCount - a.resultCount)
      .slice(0, 5)
      .map(h => h.query);

    return {
      totalSearches: this.history.length,
      averageResults: Math.round(totalResults / this.history.length),
      uniqueQueries: uniqueQueries.size,
      topQueries,
    };
  }

  async exportHistory(): Promise<string> {
    try {
      const stats = this.getHistoryStats();
      const exported = {
        exportedAt: new Date().toISOString(),
        statistics: stats,
        history: this.history,
      };

      return JSON.stringify(exported, null, 2);
    } catch (error) {
      console.error('Error exporting history:', error);
      throw error;
    }
  }

  // ==================== Cache Management ====================

  invalidateCache(): void {
    this.searchCache.clear();
    this.suggestionsCache.clear();
  }

  clearCache(): void {
    this.invalidateCache();
  }
}

export const searchService = new SearchServiceClass();
