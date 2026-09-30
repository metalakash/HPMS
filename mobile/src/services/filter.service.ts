/**
 * Filter Service
 * Filter validation, application, and query building
 */

import { api } from './api';

export interface Filter {
  id?: string;
  field: string;
  operator: 'equals' | 'contains' | 'range' | 'greater_than' | 'less_than' | 'in';
  value: any;
  label?: string;
}

export interface FilterOption {
  id: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'number' | 'range';
  operators: string[];
  values?: { label: string; value: any }[];
}

export interface FilterPreset {
  id: string;
  name: string;
  feature: string;
  filters: Filter[];
  icon?: string;
}

class FilterServiceClass {
  private filterOptions: Map<string, FilterOption[]> = new Map();
  private presets: Map<string, FilterPreset[]> = new Map();

  // ==================== Filter Validation ====================

  validateFilter(filter: Filter): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!filter.field || filter.field.trim() === '') {
      errors.push('Field is required');
    }

    if (!filter.operator) {
      errors.push('Operator is required');
    }

    if (filter.value === undefined || filter.value === null || filter.value === '') {
      errors.push('Value is required');
    }

    // Validate value based on operator
    if (filter.operator === 'range' && Array.isArray(filter.value)) {
      if (filter.value.length !== 2) {
        errors.push('Range requires min and max values');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  validateFilters(filters: Filter[]): { valid: boolean; errors: Map<number, string[]> } {
    const errors: Map<number, string[]> = new Map();
    let valid = true;

    filters.forEach((filter, index) => {
      const result = this.validateFilter(filter);
      if (!result.valid) {
        errors.set(index, result.errors);
        valid = false;
      }
    });

    return { valid, errors };
  }

  // ==================== Available Filters ====================

  async getAvailableFilters(feature: string): Promise<FilterOption[]> {
    try {
      // Check cache
      if (this.filterOptions.has(feature)) {
        return this.filterOptions.get(feature) || [];
      }

      // API call
      const response = await api.get(`/filters/available/${feature}`);
      const options = response.data || [];

      // Cache result
      this.filterOptions.set(feature, options);

      return options;
    } catch (error) {
      console.error('Error fetching available filters:', error);
      return this.getDefaultFilters(feature);
    }
  }

  private getDefaultFilters(feature: string): FilterOption[] {
    const defaults: Record<string, FilterOption[]> = {
      inspections: [
        {
          id: 'type',
          label: 'Inspection Type',
          type: 'select',
          operators: ['equals', 'in'],
          values: [
            { label: 'Routine', value: 'routine' },
            { label: 'Special', value: 'special' },
            { label: 'Follow-up', value: 'follow_up' },
          ],
        },
        {
          id: 'status',
          label: 'Status',
          type: 'select',
          operators: ['equals', 'in'],
          values: [
            { label: 'Draft', value: 'draft' },
            { label: 'Submitted', value: 'submitted' },
            { label: 'Approved', value: 'approved' },
            { label: 'Rejected', value: 'rejected' },
          ],
        },
        {
          id: 'date',
          label: 'Date',
          type: 'date',
          operators: ['range', 'greater_than', 'less_than'],
        },
        {
          id: 'priority',
          label: 'Priority',
          type: 'select',
          operators: ['equals'],
          values: [
            { label: 'Low', value: 'low' },
            { label: 'Medium', value: 'medium' },
            { label: 'High', value: 'high' },
          ],
        },
      ],
      maintenance: [
        {
          id: 'type',
          label: 'Work Order Type',
          type: 'select',
          operators: ['equals', 'in'],
          values: [
            { label: 'Preventive', value: 'preventive' },
            { label: 'Corrective', value: 'corrective' },
            { label: 'Emergency', value: 'emergency' },
          ],
        },
        {
          id: 'status',
          label: 'Status',
          type: 'select',
          operators: ['equals', 'in'],
          values: [
            { label: 'Scheduled', value: 'scheduled' },
            { label: 'In Progress', value: 'in_progress' },
            { label: 'Completed', value: 'completed' },
            { label: 'Cancelled', value: 'cancelled' },
          ],
        },
        {
          id: 'cost',
          label: 'Cost',
          type: 'range',
          operators: ['range', 'greater_than', 'less_than'],
        },
      ],
      documents: [
        {
          id: 'category',
          label: 'Category',
          type: 'select',
          operators: ['equals', 'in'],
          values: [
            { label: 'Permit', value: 'permit' },
            { label: 'Report', value: 'report' },
            { label: 'Photo', value: 'photo' },
            { label: 'Invoice', value: 'invoice' },
          ],
        },
        {
          id: 'type',
          label: 'File Type',
          type: 'select',
          operators: ['equals', 'in'],
          values: [
            { label: 'PDF', value: 'pdf' },
            { label: 'Image', value: 'image' },
            { label: 'Excel', value: 'excel' },
            { label: 'Word', value: 'word' },
          ],
        },
        {
          id: 'uploaded_date',
          label: 'Uploaded Date',
          type: 'date',
          operators: ['range', 'greater_than', 'less_than'],
        },
      ],
      covenants: [
        {
          id: 'category',
          label: 'Category',
          type: 'select',
          operators: ['equals', 'in'],
          values: [
            { label: 'Financial', value: 'financial' },
            { label: 'Operational', value: 'operational' },
            { label: 'Environmental', value: 'environmental' },
            { label: 'Reporting', value: 'reporting' },
          ],
        },
        {
          id: 'status',
          label: 'Status',
          type: 'select',
          operators: ['equals', 'in'],
          values: [
            { label: 'Compliant', value: 'compliant' },
            { label: 'Warning', value: 'warning' },
            { label: 'Breached', value: 'breached' },
            { label: 'Pending', value: 'pending' },
          ],
        },
        {
          id: 'risk_level',
          label: 'Risk Level',
          type: 'select',
          operators: ['equals'],
          values: [
            { label: 'Low', value: 'low' },
            { label: 'Medium', value: 'medium' },
            { label: 'High', value: 'high' },
          ],
        },
      ],
    };

    return defaults[feature] || [];
  }

  // ==================== Apply Filters ====================

  async applyFilters(feature: string, filters: Filter[]): Promise<any[]> {
    try {
      const validation = this.validateFilters(filters);
      if (!validation.valid) {
        throw new Error('Invalid filters');
      }

      // Build query
      const query = this.buildFilterQuery(filters);

      // API call
      const response = await api.get(`/${feature}?${query}`);
      return response.data || [];
    } catch (error) {
      console.error('Error applying filters:', error);
      throw error;
    }
  }

  buildFilterQuery(filters: Filter[]): string {
    const params = new URLSearchParams();

    filters.forEach(filter => {
      const key = `filter[${filter.field}][${filter.operator}]`;

      if (filter.operator === 'range' && Array.isArray(filter.value)) {
        params.append(`${key}[min]`, filter.value[0]);
        params.append(`${key}[max]`, filter.value[1]);
      } else if (filter.operator === 'in' && Array.isArray(filter.value)) {
        filter.value.forEach((val: any) => {
          params.append(key, val);
        });
      } else {
        params.append(key, filter.value);
      }
    });

    return params.toString();
  }

  // ==================== Filter Presets ====================

  async getFilterPresets(feature: string): Promise<FilterPreset[]> {
    try {
      // Check cache
      if (this.presets.has(feature)) {
        return this.presets.get(feature) || [];
      }

      // API call
      const response = await api.get(`/filter-presets?feature=${feature}`);
      const presets = response.data || [];

      // Cache result
      this.presets.set(feature, presets);

      return presets;
    } catch (error) {
      console.error('Error fetching filter presets:', error);
      return this.getDefaultPresets(feature);
    }
  }

  private getDefaultPresets(feature: string): FilterPreset[] {
    const defaults: Record<string, FilterPreset[]> = {
      inspections: [
        {
          id: 'recent',
          name: 'This Week',
          feature: 'inspections',
          filters: [
            {
              field: 'date',
              operator: 'greater_than',
              value: this.getDateNDaysAgo(7),
            },
          ],
          icon: '📅',
        },
        {
          id: 'high_priority',
          name: 'High Priority',
          feature: 'inspections',
          filters: [
            {
              field: 'priority',
              operator: 'equals',
              value: 'high',
            },
          ],
          icon: '🔴',
        },
      ],
      maintenance: [
        {
          id: 'scheduled',
          name: 'Scheduled',
          feature: 'maintenance',
          filters: [
            {
              field: 'status',
              operator: 'equals',
              value: 'scheduled',
            },
          ],
          icon: '📅',
        },
      ],
    };

    return defaults[feature] || [];
  }

  private getDateNDaysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }

  // ==================== Cache Management ====================

  invalidateCache(feature?: string): void {
    if (feature) {
      this.filterOptions.delete(feature);
      this.presets.delete(feature);
    } else {
      this.filterOptions.clear();
      this.presets.clear();
    }
  }
}

export const filterService = new FilterServiceClass();
