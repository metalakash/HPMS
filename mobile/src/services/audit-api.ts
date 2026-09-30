/**
 * Audit API Service
 * API endpoints for audit operations
 */

import { api } from './api';
import {
  AuditLog,
  AuditLogQuery,
  AuditStats,
  ActionType,
  Severity,
  Feature,
} from './audit.service';

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: {
    actionType?: ActionType | 'all';
    feature?: Feature | 'all';
    user?: string;
    dateRange?: { start: string; end: string };
  };
  createdAt: string;
  lastUsed: string;
}

export interface AuditExportResponse {
  url: string;
  format: 'csv' | 'json';
  fileName: string;
}

class AuditAPIService {
  private baseUrl = '/audits';

  /**
   * GET /audits
   * List audit logs with filtering and pagination
   */
  async listAudits(query: {
    dateStart?: string;
    dateEnd?: string;
    action?: ActionType | 'all';
    feature?: Feature | 'all';
    userId?: string;
    text?: string;
    page?: number;
    limit?: number;
  }): Promise<{ logs: AuditLog[]; total: number; page: number; limit: number }> {
    try {
      const params = new URLSearchParams();
      if (query.dateStart) params.append('dateStart', query.dateStart);
      if (query.dateEnd) params.append('dateEnd', query.dateEnd);
      if (query.action) params.append('action', query.action);
      if (query.feature) params.append('feature', query.feature);
      if (query.userId) params.append('userId', query.userId);
      if (query.text) params.append('text', query.text);
      params.append('page', String(query.page || 1));
      params.append('limit', String(query.limit || 25));

      const response = await api.get(`${this.baseUrl}?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error listing audits:', error);
      throw error;
    }
  }

  /**
   * GET /audits/{id}
   * Fetch single audit log by ID
   */
  async getAudit(logId: string): Promise<AuditLog> {
    try {
      const response = await api.get(`${this.baseUrl}/${logId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching audit:', error);
      throw error;
    }
  }

  /**
   * POST /audits/search
   * Advanced search with complex query and filters
   */
  async searchAudits(payload: {
    query: string;
    filters: {
      actionType?: ActionType[];
      feature?: Feature[];
      user?: string;
      changeType?: string[];
      severity?: Severity | 'all';
    };
    page?: number;
    limit?: number;
  }): Promise<{
    logs: AuditLog[];
    total: number;
    query: string;
    appliedFilters: any;
  }> {
    try {
      const response = await api.post(`${this.baseUrl}/search`, payload);
      return response.data;
    } catch (error) {
      console.error('Error searching audits:', error);
      throw error;
    }
  }

  /**
   * GET /audits/user/{userId}
   * Get all actions by a specific user
   */
  async getUserAudits(userId: string, limit?: number): Promise<AuditLog[]> {
    try {
      const params = limit ? `?limit=${limit}` : '';
      const response = await api.get(`${this.baseUrl}/user/${userId}${params}`);
      return response.data || [];
    } catch (error) {
      console.error('Error fetching user audits:', error);
      throw error;
    }
  }

  /**
   * GET /audits/record/{recordId}
   * Get all events for a specific record
   */
  async getRecordAudits(
    recordId: string,
    feature: Feature,
    limit?: number
  ): Promise<AuditLog[]> {
    try {
      const params = new URLSearchParams();
      params.append('feature', feature);
      if (limit) params.append('limit', String(limit));

      const response = await api.get(`${this.baseUrl}/record/${recordId}?${params.toString()}`);
      return response.data || [];
    } catch (error) {
      console.error('Error fetching record audits:', error);
      throw error;
    }
  }

  /**
   * GET /audits/export
   * Export filtered audit logs to file
   */
  async exportAudits(query: {
    dateStart?: string;
    dateEnd?: string;
    action?: ActionType | 'all';
    feature?: Feature | 'all';
    format?: 'csv' | 'json';
  }): Promise<Blob> {
    try {
      const params = new URLSearchParams();
      if (query.dateStart) params.append('dateStart', query.dateStart);
      if (query.dateEnd) params.append('dateEnd', query.dateEnd);
      if (query.action) params.append('action', query.action);
      if (query.feature) params.append('feature', query.feature);
      params.append('format', query.format || 'csv');

      const response = await api.get(`${this.baseUrl}/export?${params.toString()}`, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      console.error('Error exporting audits:', error);
      throw error;
    }
  }

  /**
   * GET /audits/stats
   * Get aggregated audit statistics
   */
  async getStats(query?: {
    dateStart?: string;
    dateEnd?: string;
    groupBy?: 'action' | 'feature' | 'user';
  }): Promise<AuditStats & { breakdown: any; topUsers: any; timeline: any }> {
    try {
      const params = new URLSearchParams();
      if (query?.dateStart) params.append('dateStart', query.dateStart);
      if (query?.dateEnd) params.append('dateEnd', query.dateEnd);
      if (query?.groupBy) params.append('groupBy', query.groupBy);

      const response = await api.get(`${this.baseUrl}/stats?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching stats:', error);
      throw error;
    }
  }

  /**
   * GET /audits/saved-searches
   * Get user's saved searches
   */
  async getSavedSearches(): Promise<SavedSearch[]> {
    try {
      const response = await api.get(`${this.baseUrl}/saved-searches`);
      return response.data || [];
    } catch (error) {
      console.error('Error fetching saved searches:', error);
      throw error;
    }
  }

  /**
   * POST /audits/saved-searches
   * Save a new search
   */
  async saveSavedSearch(payload: {
    name: string;
    query: string;
    filters: SavedSearch['filters'];
  }): Promise<SavedSearch> {
    try {
      const response = await api.post(`${this.baseUrl}/saved-searches`, payload);
      return response.data;
    } catch (error) {
      console.error('Error saving search:', error);
      throw error;
    }
  }

  /**
   * DELETE /audits/saved-searches/{id}
   * Delete a saved search (owner only)
   */
  async deleteSavedSearch(searchId: string): Promise<void> {
    try {
      await api.delete(`${this.baseUrl}/saved-searches/${searchId}`);
    } catch (error) {
      console.error('Error deleting saved search:', error);
      throw error;
    }
  }

  /**
   * POST /audits/{id}/rollback
   * Rollback an audit event (admin only)
   */
  async rollbackAudit(logId: string, reason: string): Promise<{
    success: boolean;
    restoredData: any;
    rollbackLogId: string;
  }> {
    try {
      const response = await api.post(`${this.baseUrl}/${logId}/rollback`, {
        reason,
      });
      return response.data;
    } catch (error) {
      console.error('Error rolling back audit:', error);
      throw error;
    }
  }

  /**
   * GET /audits/{id}/related
   * Get related audit events for a record
   */
  async getRelatedAudits(logId: string): Promise<AuditLog[]> {
    try {
      const response = await api.get(`${this.baseUrl}/${logId}/related`);
      return response.data || [];
    } catch (error) {
      console.error('Error fetching related audits:', error);
      throw error;
    }
  }

  /**
   * POST /audits/bulk-export
   * Export multiple audit events with custom selection
   */
  async bulkExportAudits(payload: {
    logIds: string[];
    format: 'csv' | 'json';
    includeMetadata?: boolean;
  }): Promise<Blob> {
    try {
      const response = await api.post(`${this.baseUrl}/bulk-export`, payload, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      console.error('Error bulk exporting audits:', error);
      throw error;
    }
  }

  /**
   * GET /audits/compliance/report
   * Generate compliance report from audit logs
   */
  async getComplianceReport(query?: {
    dateStart?: string;
    dateEnd?: string;
    features?: Feature[];
    users?: string[];
  }): Promise<{
    reportId: string;
    generatedAt: string;
    period: { start: string; end: string };
    summary: {
      totalEvents: number;
      criticalEvents: number;
      userCount: number;
      affectedFeatures: string[];
    };
    details: AuditLog[];
  }> {
    try {
      const params = new URLSearchParams();
      if (query?.dateStart) params.append('dateStart', query.dateStart);
      if (query?.dateEnd) params.append('dateEnd', query.dateEnd);
      if (query?.features?.length) params.append('features', query.features.join(','));
      if (query?.users?.length) params.append('users', query.users.join(','));

      const response = await api.get(`${this.baseUrl}/compliance/report?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching compliance report:', error);
      throw error;
    }
  }
}

export const auditAPI = new AuditAPIService();
