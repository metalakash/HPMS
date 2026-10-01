import { BaseModal } from './BaseModal';
import { Spinner } from '@/components/common/Spinner';
import type { ConfirmationModalProps } from '@/types/modal';

/**
 * ConfirmationModal: For confirming destructive or important actions.
 * Displays a message and requires explicit user confirmation.
 */
export function ConfirmationModal({
  isOpen,
  onClose,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDangerous = false,
  isLoading = false,
  onConfirm,
}: ConfirmationModalProps) {
  const handleConfirm = async () => {
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      // Error handling is up to the caller
      console.error('Confirmation action failed:', error);
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
        {cancelText}
      </button>
      <button
        type="button"
        onClick={handleConfirm}
        disabled={isLoading}
        className={`px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
          isDangerous
            ? 'bg-danger hover:bg-danger/90'
            : 'bg-primary hover:bg-primary/90'
        }`}
      >
        {isLoading && <Spinner size="sm" />}
        {confirmText}
      </button>
    </div>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={footer}
    >
      <p className="text-sm text-muted">{message}</p>
    </BaseModal>
  );
}
