/**
 * Bulk Operation Service
 * Main service orchestrating bulk operations
 */

import { bulkAPI, BulkOperationType, BulkOperationResponse, BulkStatusResponse, OperationResult, BulkOperationSummary, ExportFormat } from './bulk-api';
import { bulkValidation, ValidationResult } from './bulk-validation.service';
import { bulkOperationManager, ProgressUpdate } from './bulk-operation-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';

const OPERATION_HISTORY_KEY = 'bulk_operations_history';
const MAX_STORED_OPERATIONS = 50;

export interface StoredOperation {
  operationId: string;
  type: BulkOperationType;
  itemCount: number;
  status: string;
  timestamp: string;
  successRate?: number;
}

type ProgressCallback = (update: ProgressUpdate) => void;

class BulkOperationService {
  private operationHistory: StoredOperation[] = [];

  constructor() {
    this.loadOperationHistory();
  }

  // ==================== Bulk Operations ====================

  async startBulkUpdate(
    itemIds: string[],
    updates: Record<string, any>
  ): Promise<string> {
    // Validate
    const validation = bulkValidation.validateBatchSize(itemIds.length, 'update');
    if (!validation.valid) {
      throw new Error(validation.errors.join('; '));
    }

    try {
      const response = await bulkAPI.bulkUpdate(itemIds, updates);
      const operationId = response.operationId;

      // Track operation
      await this.recordOperation(operationId, 'update', itemIds.length);

      // Start monitoring
      this.startOperationMonitoring(operationId);

      return operationId;
    } catch (error) {
      console.error('Error starting bulk update:', error);
      throw error;
    }
  }

  async startBulkDelete(itemIds: string[]): Promise<string> {
    // Validate
    const validation = bulkValidation.validateBatchSize(itemIds.length, 'delete');
    if (!validation.valid) {
      throw new Error(validation.errors.join('; '));
    }

    try {
      const response = await bulkAPI.bulkDelete(itemIds);
      const operationId = response.operationId;

      await this.recordOperation(operationId, 'delete', itemIds.length);
      this.startOperationMonitoring(operationId);

      return operationId;
    } catch (error) {
      console.error('Error starting bulk delete:', error);
      throw error;
    }
  }

  async startBulkArchive(itemIds: string[], reason?: string): Promise<string> {
    // Validate
    const validation = bulkValidation.validateBatchSize(itemIds.length, 'archive');
    if (!validation.valid) {
      throw new Error(validation.errors.join('; '));
    }

    try {
      const response = await bulkAPI.bulkArchive(itemIds, reason);
      const operationId = response.operationId;

      await this.recordOperation(operationId, 'archive', itemIds.length);
      this.startOperationMonitoring(operationId);

      return operationId;
    } catch (error) {
      console.error('Error starting bulk archive:', error);
      throw error;
    }
  }

  async startBulkRestore(itemIds: string[]): Promise<string> {
    // Validate
    const validation = bulkValidation.validateBatchSize(itemIds.length, 'restore');
    if (!validation.valid) {
      throw new Error(validation.errors.join('; '));
    }

    try {
      const response = await bulkAPI.bulkRestore(itemIds);
      const operationId = response.operationId;

      await this.recordOperation(operationId, 'restore', itemIds.length);
      this.startOperationMonitoring(operationId);

      return operationId;
    } catch (error) {
      console.error('Error starting bulk restore:', error);
      throw error;
    }
  }

  async startBulkExport(
    itemIds: string[],
    format: ExportFormat,
    fields?: string[]
  ): Promise<{ url: string; expiresIn: number }> {
    // Validate
    const validation = bulkValidation.validateBulkExport([], format, fields);
    if (!validation.valid) {
      throw new Error(validation.errors.join('; '));
    }

    try {
      const result = await bulkAPI.bulkExport(itemIds, format, fields, true);
      await this.recordOperation('export', 'export', itemIds.length);
      return result;
    } catch (error) {
      console.error('Error starting bulk export:', error);
      throw error;
    }
  }

  async startBulkDuplicate(
    itemIds: string[],
    count: number = 1,
    templateId?: string
  ): Promise<string> {
    // Validate
    const validation = bulkValidation.validateBulkDuplicate([], count);
    if (!validation.valid) {
      throw new Error(validation.errors.join('; '));
    }

    try {
      const response = await bulkAPI.bulkDuplicate(itemIds, templateId, count);
      const operationId = response.operationId;

      await this.recordOperation(operationId, 'duplicate', itemIds.length * count);
      this.startOperationMonitoring(operationId);

      return operationId;
    } catch (error) {
      console.error('Error starting bulk duplicate:', error);
      throw error;
    }
  }

  // ==================== Operation Monitoring ====================

  private startOperationMonitoring(operationId: string): void {
    const pollInterval = setInterval(async () => {
      try {
        const status = await bulkAPI.getOperationStatus(operationId);

        if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('Error polling operation status:', error);
      }
    }, 2000); // Poll every 2 seconds
  }

  async getOperationStatus(operationId: string): Promise<BulkStatusResponse> {
    try {
      return await bulkAPI.getOperationStatus(operationId);
    } catch (error) {
      console.error('Error fetching operation status:', error);
      throw error;
    }
  }

  async getOperationResults(operationId: string): Promise<OperationResult[]> {
    try {
      return await bulkAPI.getOperationResults(operationId);
    } catch (error) {
      console.error('Error fetching operation results:', error);
      throw error;
    }
  }

  async getOperationSummary(operationId: string): Promise<BulkOperationSummary> {
    try {
      return await bulkAPI.getOperationSummary(operationId);
    } catch (error) {
      console.error('Error fetching operation summary:', error);
      throw error;
    }
  }

  // ==================== Operation Control ====================

  async cancelOperation(operationId: string): Promise<void> {
    try {
      await bulkAPI.cancelOperation(operationId);
    } catch (error) {
      console.error('Error cancelling operation:', error);
      throw error;
    }
  }

  async pauseOperation(operationId: string): Promise<void> {
    try {
      await bulkAPI.pauseOperation(operationId);
    } catch (error) {
      console.error('Error pausing operation:', error);
      throw error;
    }
  }

  async resumeOperation(operationId: string): Promise<void> {
    try {
      await bulkAPI.resumeOperation(operationId);
    } catch (error) {
      console.error('Error resuming operation:', error);
      throw error;
    }
  }

  // ==================== Retry Failed Items ====================

  async retryFailedItems(operationId: string): Promise<string> {
    try {
      const response = await bulkAPI.retryFailedItems(operationId);
      return response.operationId;
    } catch (error) {
      console.error('Error retrying failed items:', error);
      throw error;
    }
  }

  // ==================== Rollback ====================

  canRollback(operationType: BulkOperationType): boolean {
    return bulkOperationManager.canRollback(operationType);
  }

  async rollbackOperation(operationId: string): Promise<number> {
    try {
      const result = await bulkAPI.rollbackOperation(operationId);
      if (result.success) {
        return result.itemsRestored;
      }
      throw new Error('Rollback failed');
    } catch (error) {
      console.error('Error rolling back operation:', error);
      throw error;
    }
  }

  // ==================== Progress Tracking ====================

  onProgress(operationId: string, callback: ProgressCallback): () => void {
    return bulkOperationManager.onProgress(operationId, callback);
  }

  // ==================== Operation History ====================

  private async recordOperation(
    operationId: string,
    type: BulkOperationType,
    itemCount: number
  ): Promise<void> {
    const operation: StoredOperation = {
      operationId,
      type,
      itemCount,
      status: 'processing',
      timestamp: new Date().toISOString(),
    };

    this.operationHistory.unshift(operation);

    // Keep only last 50 operations
    if (this.operationHistory.length > MAX_STORED_OPERATIONS) {
      this.operationHistory = this.operationHistory.slice(0, MAX_STORED_OPERATIONS);
    }

    await this.saveOperationHistory();
  }

  async getOperationHistory(): Promise<StoredOperation[]> {
    return this.operationHistory;
  }

  private async saveOperationHistory(): Promise<void> {
    try {
      await AsyncStorage.setItem(OPERATION_HISTORY_KEY, JSON.stringify(this.operationHistory));
    } catch (error) {
      console.error('Error saving operation history:', error);
    }
  }

  private async loadOperationHistory(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(OPERATION_HISTORY_KEY);
      if (stored) {
        this.operationHistory = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading operation history:', error);
    }
  }

  async clearHistory(): Promise<void> {
    this.operationHistory = [];
    try {
      await AsyncStorage.removeItem(OPERATION_HISTORY_KEY);
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  }
}

export const bulkOperationService = new BulkOperationService();
