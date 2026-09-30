/**
 * Hook for managing justification form state and submission
 */

import { useState, useCallback } from 'react';
import { useModalStore } from '@/store/useModalStore';
import { apiClient } from '@/services/api';
import type { JustificationData } from '@/types/modal';

interface UseJustificationFormOptions {
  entityType: string;
  entityId: string;
  action: string;
  onSuccess?: (approvalRequestId: string) => void;
  onError?: (error: string) => void;
}

interface UseJustificationFormReturn {
  reason: string;
  setReason: (reason: string) => void;
  documentFile: File | null;
  setDocumentFile: (file: File | null) => void;
  isLoading: boolean;
  error: string;
  clearError: () => void;
  submit: () => Promise<void>;
  reset: () => void;
}

/**
 * Hook for managing justification form state and submission.
 * Handles form validation, API calls, and error handling.
 */
export function useJustificationForm({
  entityType,
  entityId,
  action,
  onSuccess,
  onError,
}: UseJustificationFormOptions): UseJustificationFormReturn {
  const { closeModal } = useModalStore();

  const [reason, setReason] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const clearError = useCallback(() => setError(''), []);

  const reset = useCallback(() => {
    setReason('');
    setDocumentFile(null);
    setError('');
  }, []);

  const submit = useCallback(async () => {
    setError('');

    // Validate
    if (!reason || reason.trim().length < 20) {
      setError('Justification must be at least 20 characters');
      return;
    }

    setIsLoading(true);

    try {
      // Upload document if provided
      let documentUrl: string | undefined;
      if (documentFile) {
        // TODO: Upload to S3/storage
        // For now, just use the filename
        documentUrl = documentFile.name;
      }

      // Submit mutation to backend
      const response = await apiClient.post('/mutations/submit-with-justification', {
        entity_type: entityType,
        entity_id: entityId,
        action: action,
        changes: {
          // TODO: Include actual changes based on entity type
          updated_at: new Date().toISOString(),
        },
        justification: reason.trim(),
        document_url: documentUrl,
      });

      const approvalRequestId = response.data.approval_request_id;

      // Clear form
      reset();
      closeModal('justification');

      // Notify caller
      onSuccess?.(approvalRequestId);
    } catch (err) {
      const errorMessage = err instanceof Error
        ? err.message
        : 'Failed to submit mutation';

      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [reason, documentFile, entityType, entityId, action, reset, closeModal, onSuccess, onError]);

  return {
    reason,
    setReason,
    documentFile,
    setDocumentFile,
    isLoading,
    error,
    clearError,
    submit,
    reset,
  };
}
