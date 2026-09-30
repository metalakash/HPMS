/**
 * Hook for bulk import operations with validation
 */

import { useState } from 'react';
import { apiClient } from '@/services/api';
import type { ImportValidationResult } from '@/types/modal';

interface UseBulkImportOptions {
  entityType: 'projects' | 'loans' | 'generation' | 'disbursements';
  onSuccess?: (result: ImportValidationResult) => void;
  onError?: (error: string) => void;
}

export function useBulkImport({ entityType, onSuccess, onError }: UseBulkImportOptions) {
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string>('');

  const validate = async (file: File) => {
    setIsValidating(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiClient.post(`/loans/bulk-import/validate`, formData);
      const result = response.data as ImportValidationResult;

      onSuccess?.(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Validation failed';
      setError(message);
      onError?.(message);
      throw err;
    } finally {
      setIsValidating(false);
    }
  };

  const importData = async (file: File) => {
    setIsImporting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entity_type', entityType);

      const response = await apiClient.post(`/loans/bulk-import`, formData);
      return response.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed';
      setError(message);
      onError?.(message);
      throw err;
    } finally {
      setIsImporting(false);
    }
  };

  return {
    isValidating,
    isImporting,
    error,
    validate,
    importData,
  };
}
