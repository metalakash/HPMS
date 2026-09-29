/**
 * Bulk API Service
 * API endpoints for bulk operations
 */

import { api } from './api';

export type BulkOperationType = 'update' | 'delete' | 'archive' | 'restore' | 'export' | 'duplicate';
export type ExportFormat = 'csv' | 'json' | 'excel';

export interface BulkOperationRequest {
  type: BulkOperationType;
  itemIds: string[];
  config?: Record<string, any>;
}

export interface BulkOperationResponse {
  operationId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  queuePosition?: number;
  estimatedTime?: number;
}

export interface BulkStatusResponse {
  operationId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  processedItems: number;
  totalItems: number;
  successfulItems: number;
  failedItems: number;
  skippedItems: number;
  currentItem?: string;
  elapsedTime: number;
  estimatedTimeRemaining?: number;
  error?: string;
}

export interface OperationResult {
  itemId: string;
  status: 'success' | 'failed' | 'skipped';
  itemTitle: string;
  action: string;
  error?: string;
  errorCode?: string;
  timestamp: string;
}

export interface BulkOperationSummary {
  operationId: string;
  operationType: BulkOperationType;
  totalItems: number;
  successful: number;
  failed: number;
  skipped: number;
  executionTime: number;
  startTime: string;
  completedTime: string;
  successRate: number;
  averageTimePerItem: number;
}

class BulkAPIService {
  private baseUrl = '/bulk';

  // ==================== Bulk Update ====================

  async bulkUpdate(
    itemIds: string[],
    updates: Record<string, any>
  ): Promise<BulkOperationResponse> {
    try {
      const response = await api.post(`${this.baseUrl}/update`, {
        itemIds,
        updates,
      });
      return response.data;
    } catch (error) {
      console.error('Error starting bulk update:', error);
      throw error;
    }
  }

  // ==================== Bulk Delete ====================

  async bulkDelete(itemIds: string[]): Promise<BulkOperationResponse> {
    try {
      const response = await api.post(`${this.baseUrl}/delete`, {
        itemIds,
      });
      return response.data;
    } catch (error) {
      console.error('Error starting bulk delete:', error);
      throw error;
    }
  }

  // ==================== Bulk Archive ====================

  async bulkArchive(
    itemIds: string[],
    reason?: string
  ): Promise<BulkOperationResponse> {
    try {
      const response = await api.post(`${this.baseUrl}/archive`, {
        itemIds,
        reason,
      });
      return response.data;
    } catch (error) {
      console.error('Error starting bulk archive:', error);
      throw error;
    }
  }

  // ==================== Bulk Restore ====================

  async bulkRestore(itemIds: string[]): Promise<BulkOperationResponse> {
    try {
      const response = await api.post(`${this.baseUrl}/restore`, {
        itemIds,
      });
      return response.data;
    } catch (error) {
      console.error('Error starting bulk restore:', error);
      throw error;
    }
  }

  // ==================== Bulk Export ====================

  async bulkExport(
    itemIds: string[],
    format: ExportFormat,
    fields?: string[],
    includeMetadata?: boolean
  ): Promise<{ url: string; expiresIn: number }> {
    try {
      const response = await api.post(`${this.baseUrl}/export`, {
        itemIds,
        format,
        fields,
        includeMetadata,
      });
      return response.data;
    } catch (error) {
      console.error('Error starting bulk export:', error);
      throw error;
    }
  }

  // ==================== Bulk Duplicate ====================

  async bulkDuplicate(
    itemIds: string[],
    templateId?: string,
    count: number = 1
  ): Promise<BulkOperationResponse> {
    try {
      const response = await api.post(`${this.baseUrl}/duplicate`, {
        itemIds,
        templateId,
        count,
      });
      return response.data;
    } catch (error) {
      console.error('Error starting bulk duplicate:', error);
      throw error;
    }
  }

  // ==================== Operation Status ====================

  async getOperationStatus(operationId: string): Promise<BulkStatusResponse> {
    try {
      const response = await api.get(`${this.baseUrl}/status/${operationId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching operation status:', error);
      throw error;
    }
  }

  // ==================== Operation Results ====================

  async getOperationResults(operationId: string): Promise<OperationResult[]> {
    try {
      const response = await api.get(`${this.baseUrl}/results/${operationId}`);
      return response.data || [];
    } catch (error) {
      console.error('Error fetching operation results:', error);
      throw error;
    }
  }

  async getOperationSummary(operationId: string): Promise<BulkOperationSummary> {
    try {
      const response = await api.get(`${this.baseUrl}/summary/${operationId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching operation summary:', error);
      throw error;
    }
  }

  // ==================== Operation Control ====================

  async cancelOperation(operationId: string): Promise<{ success: boolean }> {
    try {
      const response = await api.post(`${this.baseUrl}/cancel/${operationId}`, {});
      return response.data;
    } catch (error) {
      console.error('Error cancelling operation:', error);
      throw error;
    }
  }

  async pauseOperation(operationId: string): Promise<{ success: boolean }> {
    try {
      const response = await api.post(`${this.baseUrl}/pause/${operationId}`, {});
      return response.data;
    } catch (error) {
      console.error('Error pausing operation:', error);
      throw error;
    }
  }

  async resumeOperation(operationId: string): Promise<{ success: boolean }> {
    try {
      const response = await api.post(`${this.baseUrl}/resume/${operationId}`, {});
      return response.data;
    } catch (error) {
      console.error('Error resuming operation:', error);
      throw error;
    }
  }

  // ==================== Rollback ====================

  async rollbackOperation(operationId: string): Promise<{ success: boolean; itemsRestored: number }> {
    try {
      const response = await api.post(`${this.baseUrl}/rollback/${operationId}`, {});
      return response.data;
    } catch (error) {
      console.error('Error rolling back operation:', error);
      throw error;
    }
  }

  // ==================== Retry Failed Items ====================

  async retryFailedItems(operationId: string): Promise<BulkOperationResponse> {
    try {
      const response = await api.post(`${this.baseUrl}/retry/${operationId}`, {});
      return response.data;
    } catch (error) {
      console.error('Error retrying failed items:', error);
      throw error;
    }
  }
}

export const bulkAPI = new BulkAPIService();
