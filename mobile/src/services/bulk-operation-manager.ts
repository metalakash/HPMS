/**
 * Bulk Operation Manager
 * Operation execution engine with concurrency and rollback support
 */

import { BulkOperationType } from './bulk-api';

export interface ExecutingOperation {
  id: string;
  type: BulkOperationType;
  itemIds: string[];
  config?: Record<string, any>;
  status: 'queued' | 'processing' | 'paused' | 'completed' | 'failed' | 'cancelled';
  processedItems: number;
  successfulItems: number;
  failedItems: number;
  skippedItems: number;
  currentItem?: string;
  startTime: number;
  elapsedTime: number;
  estimatedTimeRemaining?: number;
  error?: string;
  isPaused: boolean;
  changeLog: ChangeLogEntry[];
  shadowCopy?: Record<string, any>;
}

export interface ChangeLogEntry {
  itemId: string;
  field: string;
  oldValue: any;
  newValue: any;
  timestamp: number;
}

export interface ProgressUpdate {
  operationId: string;
  processedItems: number;
  totalItems: number;
  successfulItems: number;
  failedItems: number;
  skippedItems: number;
  currentItem?: string;
  elapsedTime: number;
  estimatedTimeRemaining?: number;
}

type ProgressCallback = (update: ProgressUpdate) => void;

class BulkOperationManager {
  private executingOperations: Map<string, ExecutingOperation> = new Map();
  private executionQueue: ExecutingOperation[] = [];
  private progressCallbacks: Map<string, ProgressCallback[]> = new Map();
  private maxConcurrentOperations = 5;
  private maxConcurrentRequestsPerOp = 5;
  private undoStack: Map<string, ChangeLogEntry[]> = new Map();
  private readonly MAX_UNDO_HISTORY = 5;

  // ==================== Operation Execution ====================

  async executeOperation(
    operationId: string,
    type: BulkOperationType,
    itemIds: string[],
    config?: Record<string, any>
  ): Promise<void> {
    const operation: ExecutingOperation = {
      id: operationId,
      type,
      itemIds,
      config,
      status: 'queued',
      processedItems: 0,
      successfulItems: 0,
      failedItems: 0,
      skippedItems: 0,
      startTime: Date.now(),
      elapsedTime: 0,
      isPaused: false,
      changeLog: [],
    };

    this.executingOperations.set(operationId, operation);
    this.executionQueue.push(operation);

    // Start processing if below concurrency limit
    if (this.executingOperations.size <= this.maxConcurrentOperations) {
      await this.processNextOperation();
    }
  }

  private async processNextOperation(): Promise<void> {
    const operation = this.executionQueue.shift();
    if (!operation) return;

    operation.status = 'processing';
    this.emitProgressUpdate(operation);

    try {
      await this.processBatch(
        operation.itemIds,
        operation.type,
        operation.config,
        operation
      );

      operation.status = 'completed';
    } catch (error) {
      operation.status = 'failed';
      operation.error = (error as Error).message;
    }

    this.emitProgressUpdate(operation);

    // Process next operation in queue
    if (this.executionQueue.length > 0) {
      await this.processNextOperation();
    }
  }

  private async processBatch(
    itemIds: string[],
    operationType: BulkOperationType,
    config: Record<string, any> | undefined,
    operation: ExecutingOperation
  ): Promise<void> {
    const chunks = this.chunkArray(itemIds, this.maxConcurrentRequestsPerOp);

    for (const chunk of chunks) {
      if (operation.isPaused) {
        await this.waitUntilResumed(operation);
      }

      if (operation.status === 'cancelled') {
        break;
      }

      const promises = chunk.map(itemId =>
        this.processItem(itemId, operationType, config, operation)
      );

      const results = await Promise.allSettled(promises);

      results.forEach((result, index) => {
        const itemId = chunk[index];
        if (result.status === 'fulfilled') {
          if (result.value === 'success') {
            operation.successfulItems++;
          } else if (result.value === 'skipped') {
            operation.skippedItems++;
          } else {
            operation.failedItems++;
          }
        } else {
          operation.failedItems++;
        }
        operation.processedItems++;
      });

      this.updateTimings(operation);
      this.emitProgressUpdate(operation);
    }
  }

  private async processItem(
    itemId: string,
    operationType: BulkOperationType,
    config: Record<string, any> | undefined,
    operation: ExecutingOperation
  ): Promise<'success' | 'failed' | 'skipped'> {
    try {
      // Simulate item processing based on operation type
      operation.currentItem = `Item ${itemId}`;

      // Log change for rollback support
      if (operationType === 'update' && config?.field) {
        operation.changeLog.push({
          itemId,
          field: config.field,
          oldValue: null, // Would fetch actual old value from backend
          newValue: config.value,
          timestamp: Date.now(),
        });
      }

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 100));

      // Random chance of failure for testing
      if (Math.random() > 0.95) {
        throw new Error(`Failed to process item ${itemId}`);
      }

      return 'success';
    } catch (error) {
      console.error(`Error processing item ${itemId}:`, error);
      return 'failed';
    }
  }

  // ==================== Concurrency Management ====================

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private updateTimings(operation: ExecutingOperation): void {
    operation.elapsedTime = Date.now() - operation.startTime;

    if (operation.processedItems > 0) {
      const timePerItem = operation.elapsedTime / operation.processedItems;
      const remainingItems = operation.itemIds.length - operation.processedItems;
      operation.estimatedTimeRemaining = Math.round(timePerItem * remainingItems);
    }
  }

  private emitProgressUpdate(operation: ExecutingOperation): void {
    const callbacks = this.progressCallbacks.get(operation.id) || [];
    callbacks.forEach(callback => {
      callback({
        operationId: operation.id,
        processedItems: operation.processedItems,
        totalItems: operation.itemIds.length,
        successfulItems: operation.successfulItems,
        failedItems: operation.failedItems,
        skippedItems: operation.skippedItems,
        currentItem: operation.currentItem,
        elapsedTime: operation.elapsedTime,
        estimatedTimeRemaining: operation.estimatedTimeRemaining,
      });
    });
  }

  private async waitUntilResumed(operation: ExecutingOperation): Promise<void> {
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (!operation.isPaused || operation.status === 'cancelled') {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }

  // ==================== Operation Control ====================

  pauseOperation(operationId: string): boolean {
    const operation = this.executingOperations.get(operationId);
    if (!operation) return false;

    operation.isPaused = true;
    return true;
  }

  resumeOperation(operationId: string): boolean {
    const operation = this.executingOperations.get(operationId);
    if (!operation) return false;

    operation.isPaused = false;
    return true;
  }

  cancelOperation(operationId: string): boolean {
    const operation = this.executingOperations.get(operationId);
    if (!operation) return false;

    operation.status = 'cancelled';
    return true;
  }

  // ==================== Rollback Support ====================

  canRollback(operationType: BulkOperationType): boolean {
    const reversibleOps: BulkOperationType[] = ['update', 'archive', 'duplicate'];
    return reversibleOps.includes(operationType);
  }

  async rollbackOperation(operationId: string): Promise<number> {
    const changeLog = this.undoStack.get(operationId);
    if (!changeLog || changeLog.length === 0) {
      return 0;
    }

    // Reverse changes in reverse order
    let restoredCount = 0;
    for (let i = changeLog.length - 1; i >= 0; i--) {
      const entry = changeLog[i];
      try {
        // Would call API to restore old value
        restoredCount++;
      } catch (error) {
        console.error(`Error rolling back change for item ${entry.itemId}:`, error);
      }
    }

    // Clear undo stack for this operation
    this.undoStack.delete(operationId);

    return restoredCount;
  }

  recordChangeLog(operationId: string, changeLog: ChangeLogEntry[]): void {
    // Keep only last N operations
    if (this.undoStack.size >= this.MAX_UNDO_HISTORY) {
      const firstKey = this.undoStack.keys().next().value;
      if (firstKey) this.undoStack.delete(firstKey);
    }

    this.undoStack.set(operationId, changeLog);
  }

  // ==================== Progress Tracking ====================

  onProgress(operationId: string, callback: ProgressCallback): () => void {
    if (!this.progressCallbacks.has(operationId)) {
      this.progressCallbacks.set(operationId, []);
    }

    this.progressCallbacks.get(operationId)!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.progressCallbacks.get(operationId);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  getOperationStatus(operationId: string): ExecutingOperation | undefined {
    return this.executingOperations.get(operationId);
  }

  getActiveOperationCount(): number {
    return this.executingOperations.size;
  }

  // ==================== Cleanup ====================

  clearCompleted(): void {
    const completedIds: string[] = [];

    this.executingOperations.forEach((operation, id) => {
      if (operation.status === 'completed' || operation.status === 'failed' || operation.status === 'cancelled') {
        completedIds.push(id);
      }
    });

    completedIds.forEach(id => {
      this.executingOperations.delete(id);
      this.progressCallbacks.delete(id);
    });
  }

  clearAll(): void {
    this.executingOperations.clear();
    this.executionQueue = [];
    this.progressCallbacks.clear();
    this.undoStack.clear();
  }
}

export const bulkOperationManager = new BulkOperationManager();
