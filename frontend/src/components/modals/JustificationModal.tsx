import { useState } from 'react';
import { Upload } from 'lucide-react';
import { BaseModal } from './BaseModal';
import { Spinner } from '@/components/common/Spinner';
import type { JustificationModalProps, JustificationData } from '@/types/modal';

const MIN_REASON_LENGTH = 20;

/**
 * JustificationModal: Captures mandatory justification for maker-checker mutations.
 * Enforces minimum character length and optional document upload.
 * Used for all state-changing operations requiring approval.
 */
export function JustificationModal({
  isOpen,
  onClose,
  entityType,
  entityId,
  actionName,
  isLoading = false,
  onSubmit,
}: JustificationModalProps) {
  const [reason, setReason] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [error, setError] = useState<string>('');

  const reasonLength = reason.trim().length;
  const isReasonValid = reasonLength >= MIN_REASON_LENGTH;
  const isFormValid = isReasonValid;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }
      setDocumentFile(file);
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isFormValid) {
      setError(`Reason must be at least ${MIN_REASON_LENGTH} characters`);
      return;
    }

    try {
      const data: JustificationData = {
        reason: reason.trim(),
        documentUrl: documentFile?.name, // In production, upload to S3/storage first
      };
      await onSubmit(data);
      // Reset form on success
      setReason('');
      setDocumentFile(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    }
  };

  const footer = (
    <div className="flex gap-3 justify-end">
      <button
        type="button"
        onClick={onClose}
        disabled={isLoading}
        className="px-4 py-2 rounded-lg border border-line text-sm font-medium text-fg hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Cancel
      </button>
      <button
        type="submit"
        form="justification-form"
        disabled={!isFormValid || isLoading}
        className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium flex items-center gap-2 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading && <Spinner size="sm" />}
        Submit for Approval
      </button>
    </div>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Enter Justification"
      description={`Why are you ${actionName}?`}
      size="md"
      footer={footer}
    >
      <form id="justification-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Action metadata (read-only) */}
        <div className="rounded-lg bg-surface-2 p-3 space-y-2 text-sm">
          <div>
            <span className="text-muted">Action:</span>
            <span className="ml-2 font-medium text-fg">{actionName}</span>
          </div>
          <div>
            <span className="text-muted">Entity Type:</span>
            <span className="ml-2 font-medium text-fg">{entityType}</span>
          </div>
        </div>

        {/* Reason field */}
        <div className="space-y-2">
          <label htmlFor="reason" className="block text-sm font-medium text-fg">
            Justification
            <span className="text-danger ml-1" aria-label="required">*</span>
          </label>
          <textarea
            id="reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError('');
            }}
            placeholder="Explain the reason for this change. Include relevant details, correspondence, or references..."
            rows={5}
            className={`w-full px-3 py-2 rounded-lg border bg-surface text-fg placeholder-muted transition-colors ${
              isReasonValid
                ? 'border-line focus:border-primary focus:ring-1 focus:ring-primary'
                : 'border-danger focus:border-danger focus:ring-1 focus:ring-danger/50'
            }`}
            aria-invalid={!isReasonValid && reasonLength > 0}
          />
          <div className="flex items-center justify-between text-xs">
            <span className={`text-muted ${reasonLength < MIN_REASON_LENGTH ? 'text-danger' : 'text-success'}`}>
              {reasonLength} / {MIN_REASON_LENGTH} characters
            </span>
            {isReasonValid && <span className="text-success">✓ Valid</span>}
          </div>
        </div>

        {/* Document upload field (optional) */}
        <div className="space-y-2">
          <label htmlFor="document" className="block text-sm font-medium text-fg">
            Supporting Document (Optional)
          </label>
          <div className="relative">
            <input
              type="file"
              id="document"
              onChange={handleFileChange}
              disabled={isLoading}
              className="sr-only"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png"
            />
            <label
              htmlFor="document"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-line cursor-pointer hover:border-primary hover:bg-surface-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="size-4 text-muted" />
              <span className="text-sm text-fg">
                {documentFile ? `Selected: ${documentFile.name}` : 'Click to upload or drag and drop'}
              </span>
            </label>
          </div>
          <p className="text-xs text-muted">
            PDF, DOC, DOCX, XLS, XLSX, JPG, PNG up to 10MB
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
            {error}
          </div>
        )}

        {/* Info message */}
        <div className="rounded-lg bg-info/10 p-3 text-sm text-info">
          <p className="font-medium">Note:</p>
          <p className="mt-1">This action will be logged and require approval from an authorized checker. All details will be recorded in the audit trail.</p>
        </div>
      </form>
    </BaseModal>
  );
}
