/**
 * useBulkOperation Hook
 * Orchestrate bulk operation execution
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { bulkOperationService } from '../services/bulk-operation.service';
import { BulkOperationType, BulkStatusResponse, BulkOperationSummary, OperationResult } from '../services/bulk-api';

export interface BulkOperationState {
  operationId: string | null;
  type: BulkOperationType | null;
  status: 'idle' | 'queued' | 'processing' | 'paused' | 'completed' | 'failed' | 'cancelled';
  itemCount: number;
  error: string | null;
}

export const useBulkOperation = () => {
  const [operationState, setOperationState] = useState<BulkOperationState>({
    operationId: null,
    type: null,
    status: 'idle',
    itemCount: 0,
    error: null,
  });

  const [statusInfo, setStatusInfo] = useState<BulkStatusResponse | null>(null);
  const [summary, setSummary] = useState<BulkOperationSummary | null>(null);
  const [results, setResults] = useState<OperationResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // ==================== Operation Start ====================

  const startUpdate = useCallback(
    async (itemIds: string[], updates: Record<string, any>) => {
      try {
        setIsLoading(true);
        setOperationState({
          operationId: null,
          type: 'update',
          status: 'queued',
          itemCount: itemIds.length,
          error: null,
        });

        const operationId = await bulkOperationService.startBulkUpdate(itemIds, updates);

        setOperationState(prev => ({
          ...prev,
          operationId,
          status: 'processing',
        }));

        // Subscribe to progress
        subscribeToProgress(operationId, 'update');
      } catch (err) {
        const error = (err as Error).message;
        setOperationState(prev => ({
          ...prev,
          status: 'failed',
          error,
        }));
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const startDelete = useCallback(
    async (itemIds: string[]) => {
      try {
        setIsLoading(true);
        setOperationState({
          operationId: null,
          type: 'delete',
          status: 'queued',
          itemCount: itemIds.length,
          error: null,
        });

        const operationId = await bulkOperationService.startBulkDelete(itemIds);

        setOperationState(prev => ({
          ...prev,
          operationId,
          status: 'processing',
        }));

        subscribeToProgress(operationId, 'delete');
      } catch (err) {
        const error = (err as Error).message;
        setOperationState(prev => ({
          ...prev,
          status: 'failed',
          error,
        }));
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const startArchive = useCallback(
    async (itemIds: string[], reason?: string) => {
      try {
        setIsLoading(true);
        setOperationState({
          operationId: null,
          type: 'archive',
          status: 'queued',
          itemCount: itemIds.length,
          error: null,
        });

        const operationId = await bulkOperationService.startBulkArchive(itemIds, reason);

        setOperationState(prev => ({
          ...prev,
          operationId,
          status: 'processing',
        }));

        subscribeToProgress(operationId, 'archive');
      } catch (err) {
        const error = (err as Error).message;
        setOperationState(prev => ({
          ...prev,
          status: 'failed',
          error,
        }));
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const startRestore = useCallback(
    async (itemIds: string[]) => {
      try {
        setIsLoading(true);
        setOperationState({
          operationId: null,
          type: 'restore',
          status: 'queued',
          itemCount: itemIds.length,
          error: null,
        });

        const operationId = await bulkOperationService.startBulkRestore(itemIds);

        setOperationState(prev => ({
          ...prev,
          operationId,
          status: 'processing',
        }));

        subscribeToProgress(operationId, 'restore');
      } catch (err) {
        const error = (err as Error).message;
        setOperationState(prev => ({
          ...prev,
          status: 'failed',
          error,
        }));
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const startExport = useCallback(
    async (itemIds: string[], format: 'csv' | 'json' | 'excel', fields?: string[]) => {
      try {
        setIsLoading(true);
        const result = await bulkOperationService.startBulkExport(itemIds, format, fields);
        return result;
      } catch (err) {
        const error = (err as Error).message;
        setOperationState(prev => ({
          ...prev,
          error,
        }));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const startDuplicate = useCallback(
    async (itemIds: string[], count?: number, templateId?: string) => {
      try {
        setIsLoading(true);
        setOperationState({
          operationId: null,
          type: 'duplicate',
          status: 'queued',
          itemCount: itemIds.length * (count || 1),
          error: null,
        });

        const operationId = await bulkOperationService.startBulkDuplicate(itemIds, count, templateId);

        setOperationState(prev => ({
          ...prev,
          operationId,
          status: 'processing',
        }));

        subscribeToProgress(operationId, 'duplicate');
      } catch (err) {
        const error = (err as Error).message;
        setOperationState(prev => ({
          ...prev,
          status: 'failed',
          error,
        }));
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // ==================== Operation Control ====================

  const cancelOperation = useCallback(async () => {
    if (!operationState.operationId) return;

    try {
      await bulkOperationService.cancelOperation(operationState.operationId);
      setOperationState(prev => ({
        ...prev,
        status: 'cancelled',
      }));
    } catch (err) {
      console.error('Error cancelling operation:', err);
    }
  }, [operationState.operationId]);

  const pauseOperation = useCallback(async () => {
    if (!operationState.operationId) return;

    try {
      await bulkOperationService.pauseOperation(operationState.operationId);
      setOperationState(prev => ({
        ...prev,
        status: 'paused',
      }));
    } catch (err) {
      console.error('Error pausing operation:', err);
    }
  }, [operationState.operationId]);

  const resumeOperation = useCallback(async () => {
    if (!operationState.operationId) return;

    try {
      await bulkOperationService.resumeOperation(operationState.operationId);
      setOperationState(prev => ({
        ...prev,
        status: 'processing',
      }));
    } catch (err) {
      console.error('Error resuming operation:', err);
    }
  }, [operationState.operationId]);

  // ==================== Retry & Rollback ====================

  const retryFailed = useCallback(async () => {
    if (!operationState.operationId) return;

    try {
      setIsLoading(true);
      const newOperationId = await bulkOperationService.retryFailedItems(operationState.operationId);

      setOperationState(prev => ({
        ...prev,
        operationId: newOperationId,
        status: 'processing',
      }));

      if (operationState.type) {
        subscribeToProgress(newOperationId, operationState.type);
      }
    } catch (err) {
      console.error('Error retrying failed items:', err);
    } finally {
      setIsLoading(false);
    }
  }, [operationState.operationId, operationState.type]);

  const rollback = useCallback(async () => {
    if (!operationState.operationId || !operationState.type) return;

    if (!bulkOperationService.canRollback(operationState.type)) {
      setOperationState(prev => ({
        ...prev,
        error: 'This operation cannot be rolled back',
      }));
      return;
    }

    try {
      setIsLoading(true);
      const itemsRestored = await bulkOperationService.rollbackOperation(operationState.operationId);

      setOperationState(prev => ({
        ...prev,
        status: 'completed',
      }));

      alert(`Operation rolled back. ${itemsRestored} items restored.`);
    } catch (err) {
      const error = (err as Error).message;
      setOperationState(prev => ({
        ...prev,
        error,
      }));
    } finally {
      setIsLoading(false);
    }
  }, [operationState.operationId, operationState.type]);

  // ==================== Progress Subscription ====================

  const subscribeToProgress = useCallback(
    (operationId: string, type: BulkOperationType) => {
      // Unsubscribe from previous operation
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }

      // Subscribe to new operation
      unsubscribeRef.current = bulkOperationService.onProgress(operationId, update => {
        // Update status is handled by polling, just update UI state
      });

      // Poll for status updates
      const pollInterval = setInterval(async () => {
        try {
          const status = await bulkOperationService.getOperationStatus(operationId);
          setStatusInfo(status);

          if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
            clearInterval(pollInterval);
            setOperationState(prev => ({
              ...prev,
              status: status.status as any,
            }));

            // Fetch results and summary
            if (status.status === 'completed' || status.status === 'failed') {
              const [resultsData, summaryData] = await Promise.all([
                bulkOperationService.getOperationResults(operationId),
                bulkOperationService.getOperationSummary(operationId).catch(() => null),
              ]);

              setResults(resultsData);
              if (summaryData) setSummary(summaryData);
            }
          }
        } catch (err) {
          console.error('Error polling operation status:', err);
        }
      }, 2000);
    },
    []
  );

  // ==================== Reset ====================

  const reset = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }
    setOperationState({
      operationId: null,
      type: null,
      status: 'idle',
      itemCount: 0,
      error: null,
    });
    setStatusInfo(null);
    setSummary(null);
    setResults([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  return {
    operationState,
    statusInfo,
    summary,
    results,
    isLoading,
    startUpdate,
    startDelete,
    startArchive,
    startRestore,
    startExport,
    startDuplicate,
    cancelOperation,
    pauseOperation,
    resumeOperation,
    retryFailed,
    rollback,
    reset,
    canRollback: operationState.type ? bulkOperationService.canRollback(operationState.type) : false,
  };
};
