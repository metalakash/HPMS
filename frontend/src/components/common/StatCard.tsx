import type { ReactNode } from 'react';
import { Skeleton } from './Skeleton';

/**
 * Stat tile: sentence-case label, compact value, optional context line.
 * Values use proportional figures; tabular-nums is reserved for table columns.
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  loading = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted">{label}</p>
        {icon && (
          <span className="text-muted" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-24" />
      ) : (
        <p className="mt-1 text-h2 font-semibold">{value}</p>
      )}
      {hint && !loading && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  );
}
