/**
 * Saved Filter Service
 * CRUD operations for saved filters with sharing support
 */

import { api } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Filter } from './filter.service';

const SAVED_FILTERS_KEY = 'saved_filters';
const DEFAULT_FILTER_KEY = 'default_filter';

export interface SavedFilter {
  id: string;
  name: string;
  description?: string;
  feature: string;
  filters: Filter[];
  isDefault: boolean;
  sharedWith: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

class SavedFilterServiceClass {
  private filters: Map<string, SavedFilter[]> = new Map();
  private defaultFilter: Map<string, string> = new Map(); // feature -> filterId

  constructor() {
    this.loadFilters();
    this.loadDefaultFilters();
  }

  // ==================== Get Saved Filters ====================

  async getSavedFilters(feature?: string): Promise<SavedFilter[]> {
    try {
      // API call
      const url = feature ? `/saved-filters?feature=${feature}` : '/saved-filters';
      const response = await api.get(url);
      const filters = response.data || [];

      // Update cache
      if (feature) {
        this.filters.set(feature, filters);
      } else {
        // Clear and rebuild cache
        this.filters.clear();
        filters.forEach((f: SavedFilter) => {
          if (!this.filters.has(f.feature)) {
            this.filters.set(f.feature, []);
          }
          this.filters.get(f.feature)!.push(f);
        });
      }

      // Persist locally
      await AsyncStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(filters));

      return filters;
    } catch (error) {
      console.error('Error fetching saved filters:', error);
      // Fallback to local cache
      return feature ? (this.filters.get(feature) || []) : this.getAllFiltersFromCache();
    }
  }

  async getSavedFilter(id: string): Promise<SavedFilter | null> {
    try {
      const response = await api.get(`/saved-filters/${id}`);
      return response.data || null;
    } catch (error) {
      console.error('Error fetching saved filter:', error);
      return null;
    }
  }

  // ==================== Create Saved Filter ====================

  async createSavedFilter(filter: Omit<SavedFilter, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>): Promise<SavedFilter> {
    try {
      const response = await api.post('/saved-filters', filter);
      const newFilter = response.data;

      // Update cache
      if (!this.filters.has(filter.feature)) {
        this.filters.set(filter.feature, []);
      }
      this.filters.get(filter.feature)!.push(newFilter);

      // Persist locally
      await this.persistFilters();

      return newFilter;
    } catch (error) {
      console.error('Error creating saved filter:', error);
      throw error;
    }
  }

  // ==================== Update Saved Filter ====================

  async updateSavedFilter(id: string, updates: Partial<SavedFilter>): Promise<SavedFilter> {
    try {
      const response = await api.put(`/saved-filters/${id}`, updates);
      const updated = response.data;

      // Update cache
      this.updateCachedFilter(updated);

      // Persist locally
      await this.persistFilters();

      return updated;
    } catch (error) {
      console.error('Error updating saved filter:', error);
      throw error;
    }
  }

  // ==================== Delete Saved Filter ====================

  async deleteSavedFilter(id: string): Promise<void> {
    try {
      await api.delete(`/saved-filters/${id}`);

      // Remove from cache
      this.removeCachedFilter(id);

      // Persist locally
      await this.persistFilters();

      // Clear default if it was the default filter
      const defaultFilterId = this.defaultFilter.get('*');
      if (defaultFilterId === id) {
        await this.setDefaultFilter(null);
      }
    } catch (error) {
      console.error('Error deleting saved filter:', error);
      throw error;
    }
  }

  // ==================== Filter Sharing ====================

  async shareFilter(id: string, teamMembers: string[]): Promise<SavedFilter> {
    try {
      const response = await api.post(`/saved-filters/${id}/share`, {
        sharedWith: teamMembers,
      });
      const updated = response.data;

      // Update cache
      this.updateCachedFilter(updated);

      // Persist locally
      await this.persistFilters();

      return updated;
    } catch (error) {
      console.error('Error sharing filter:', error);
      throw error;
    }
  }

  async unshareFilter(id: string, teamMember: string): Promise<SavedFilter> {
    try {
      const filter = await this.getSavedFilter(id);
      if (!filter) throw new Error('Filter not found');

      const updatedSharedWith = filter.sharedWith.filter(m => m !== teamMember);

      return this.updateSavedFilter(id, { sharedWith: updatedSharedWith });
    } catch (error) {
      console.error('Error unsharing filter:', error);
      throw error;
    }
  }

  // ==================== Default Filter ====================

  async setDefaultFilter(filterId: string | null): Promise<void> {
    try {
      if (filterId) {
        await api.post(`/saved-filters/${filterId}/set-default`, {});
        this.defaultFilter.set('*', filterId);
      } else {
        await api.delete('/saved-filters/default');
        this.defaultFilter.delete('*');
      }

      // Persist locally
      if (filterId) {
        await AsyncStorage.setItem(DEFAULT_FILTER_KEY, filterId);
      } else {
        await AsyncStorage.removeItem(DEFAULT_FILTER_KEY);
      }
    } catch (error) {
      console.error('Error setting default filter:', error);
      throw error;
    }
  }

  getDefaultFilter(): string | null {
    return this.defaultFilter.get('*') || null;
  }

  // ==================== Private Helper Methods ====================

  private updateCachedFilter(filter: SavedFilter): void {
    const featureFilters = this.filters.get(filter.feature);
    if (featureFilters) {
      const index = featureFilters.findIndex(f => f.id === filter.id);
      if (index >= 0) {
        featureFilters[index] = filter;
      } else {
        featureFilters.push(filter);
      }
    }
  }

  private removeCachedFilter(id: string): void {
    this.filters.forEach(filters => {
      const index = filters.findIndex(f => f.id === id);
      if (index >= 0) {
        filters.splice(index, 1);
      }
    });
  }

  private getAllFiltersFromCache(): SavedFilter[] {
    const allFilters: SavedFilter[] = [];
    this.filters.forEach(filters => {
      allFilters.push(...filters);
    });
    return allFilters;
  }

  private async persistFilters(): Promise<void> {
    try {
      const allFilters = this.getAllFiltersFromCache();
      await AsyncStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(allFilters));
    } catch (error) {
      console.error('Error persisting filters:', error);
    }
  }

  private async loadFilters(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(SAVED_FILTERS_KEY);
      if (stored) {
        const filters: SavedFilter[] = JSON.parse(stored);
        filters.forEach(f => {
          if (!this.filters.has(f.feature)) {
            this.filters.set(f.feature, []);
          }
          this.filters.get(f.feature)!.push(f);
        });
      }
    } catch (error) {
      console.error('Error loading filters:', error);
    }
  }

  private async loadDefaultFilters(): Promise<void> {
    try {
      const defaultId = await AsyncStorage.getItem(DEFAULT_FILTER_KEY);
      if (defaultId) {
        this.defaultFilter.set('*', defaultId);
      }
    } catch (error) {
      console.error('Error loading default filter:', error);
    }
  }

  // ==================== Cache Management ====================

  invalidateCache(): void {
    this.filters.clear();
  }
}

export const savedFilterService = new SavedFilterServiceClass();
