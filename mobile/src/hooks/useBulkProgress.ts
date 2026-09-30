/**
 * useBulkProgress Hook
 * Track and update progress during bulk operation execution
 */

import { useState, useEffect, useRef } from 'react';
import { bulkOperationService } from '../services/bulk-operation.service';

export interface ProgressStats {
  percentage: number;
  itemsPerSecond: number;
  successRate: number;
  averageTimePerItem: number;
}

export const useBulkProgress = (operationId: string | null) => {
  const [progress, setProgress] = useState({
    processedItems: 0,
    totalItems: 0,
    successfulItems: 0,
    failedItems: 0,
    skippedItems: 0,
    currentItem: '',
    elapsedTime: 0,
    estimatedTimeRemaining: 0,
  });

  const [stats, setStats] = useState<ProgressStats>({
    percentage: 0,
    itemsPerSecond: 0,
    successRate: 0,
    averageTimePerItem: 0,
  });

  const pollIntervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!operationId) return;

    // Poll for status updates
    const pollStatus = async () => {
      try {
        const status = await bulkOperationService.getOperationStatus(operationId);

        setProgress({
          processedItems: status.processedItems,
          totalItems: status.totalItems,
          successfulItems: status.successfulItems,
          failedItems: status.failedItems,
          skippedItems: status.skippedItems,
          currentItem: status.currentItem || '',
          elapsedTime: status.elapsedTime,
          estimatedTimeRemaining: status.estimatedTimeRemaining || 0,
        });

        // Calculate statistics
        const percentage = Math.round(
          (status.processedItems / status.totalItems) * 100
        );

        const successRate = status.processedItems > 0
          ? Math.round((status.successfulItems / status.processedItems) * 100)
          : 0;

        const itemsPerSecond =
          status.processedItems > 0 && status.elapsedTime > 0
            ? Number((status.processedItems / (status.elapsedTime / 1000)).toFixed(1))
            : 0;

        const averageTimePerItem =
          status.processedItems > 0
            ? Math.round(status.elapsedTime / status.processedItems)
            : 0;

        setStats({
          percentage,
          itemsPerSecond,
          successRate,
          averageTimePerItem,
        });

        // Stop polling when operation completes
        if (
          status.status === 'completed' ||
          status.status === 'failed' ||
          status.status === 'cancelled'
        ) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
        }
      } catch (error) {
        console.error('Error polling progress:', error);
      }
    };

    // Initial poll
    pollStatus();

    // Poll every 1 second
    pollIntervalRef.current = setInterval(pollStatus, 1000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [operationId]);

  const formatTime = (ms: number): string => {
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return {
    progress,
    stats,
    formattedElapsedTime: formatTime(progress.elapsedTime),
    formattedEstimatedTime: formatTime(progress.estimatedTimeRemaining),
    isProcessing: progress.processedItems < progress.totalItems,
    isComplete: progress.processedItems >= progress.totalItems,
  };
};
