import { useEffect, useRef } from 'react';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { DetailDrawerProps } from '@/types/modal';

/**
 * DetailDrawer: Right-aligned slide-over drawer for displaying drill-down details.
 * Used for viewing detailed information without navigating away from current page.
 */
export function DetailDrawer({
  isOpen,
  onClose,
  title,
  children,
  loading = false,
  footer,
}: DetailDrawerProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Prevent body scroll when drawer is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Handle click outside (backdrop click)
    const handleBackdropClick = (e: MouseEvent) => {
      if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex" role="presentation">
      {/* Backdrop overlay */}
      <div
        className="absolute inset-0 bg-black/50 dark:bg-black/70"
        aria-hidden="true"
      />

      {/* Drawer content - slides in from right */}
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className={cn(
          'relative z-10 ml-auto flex h-full w-full flex-col bg-surface',
          'max-w-md shadow-xl',
          'animate-in slide-in-from-right duration-300',
          'sm:max-w-lg',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2
            id="drawer-title"
            className="text-lg font-semibold text-fg"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex rounded-md p-1 text-muted hover:bg-surface-2 hover:text-fg"
            aria-label="Close drawer"
          >
            <ChevronLeft className="size-5" />
          </button>
        </div>

        {/* Body - scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full border-2 border-muted border-t-primary h-8 w-8" />
            </div>
          ) : (
            children
          )}
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
