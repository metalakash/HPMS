/**
 * Hook for managing justification form state and submission
 */

import { useState, useCallback } from 'react';
import { useModalStore } from '@/store/useModalStore';
import { apiClient, getErrorMessage } from '@/services/api';

interface UseJustificationFormOptions {
  entityType: string;
  entityId: string;
  action: string;
  /** Field changes being proposed for the entity. */
  changes: Record<string, unknown>;
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
  changes,
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
      const response = await apiClient.post('/api/v1/mutations/submit-with-justification', {
        entity_type: entityType,
        entity_id: entityId,
        action: action,
        changes,
        justification: reason.trim(),
        document_url: documentUrl,
      });

      const approvalRequestId = response.data.data.approval_request_id;

      // Clear form
      reset();
      closeModal('justification');

      // Notify caller
      onSuccess?.(approvalRequestId);
    } catch (err) {
      const errorMessage = getErrorMessage(err);

      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [reason, documentFile, entityType, entityId, action, changes, reset, closeModal, onSuccess, onError]);

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
