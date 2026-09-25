import type { ReactNode } from 'react';
import { AlertTriangle, Inbox } from 'lucide-react';
import { getErrorMessage } from '@/services/api';
import { Button } from './Button';

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      <div className="text-muted" aria-hidden="true">
        {icon ?? <Inbox className="size-8" />}
      </div>
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <AlertTriangle className="size-7 text-danger" aria-hidden="true" />
      <p className="font-medium">Couldn't load this data</p>
      <p className="max-w-md text-sm text-muted">{getErrorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-2">
          Try again
        </Button>
      )}
    </div>
  );
}
