import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { BaseModalProps } from '@/types/modal';

const SIZE_CLASSES: Record<string, string> = {
  sm: 'w-full max-w-sm',
  md: 'w-full max-w-md',
  lg: 'w-full max-w-lg',
  xl: 'w-full max-w-xl',
};

/**
 * BaseModal: Reusable modal wrapper with overlay, animations, and accessibility.
 * Provides foundation for all specific modal types.
 */
export function BaseModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  onBackdropClick,
}: BaseModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Prevent body scroll when modal is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Handle click outside (backdrop click)
    const handleBackdropClick = (e: MouseEvent) => {
      if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
        onBackdropClick?.();
        onClose();
      }
    };

    // Handle escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Add event listeners
    document.addEventListener('mousedown', handleBackdropClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleBackdropClick);
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose, onBackdropClick]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="presentation"
    >
      {/* Backdrop overlay */}
      <div className="absolute inset-0 bg-black/50 dark:bg-black/70" aria-hidden="true" />

      {/* Modal content */}
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        aria-describedby={description ? 'modal-description' : undefined}
        className={cn(
          'relative z-10 rounded-lg border border-line bg-surface shadow-xl',
          'animate-in fade-in zoom-in duration-200',
          'max-h-[90vh] overflow-y-auto',
          SIZE_CLASSES[size],
        )}
      >
        {/* Header */}
        {title && (
          <div className="flex items-start justify-between border-b border-line px-6 py-4">
            <div>
              <h2
                id="modal-title"
                className="text-lg font-semibold leading-6 text-fg"
              >
                {title}
              </h2>
              {description && (
                <p
                  id="modal-description"
                  className="mt-1 text-sm text-muted"
                >
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="ml-4 inline-flex rounded-md p-1 text-muted hover:bg-surface-2 hover:text-fg"
              aria-label="Close modal"
            >
              <X className="size-5" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-4">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-line px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
