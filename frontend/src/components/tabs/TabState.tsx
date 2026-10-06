import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Card } from '@/components/common/Card';
import { Skeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/States';

/** Loading and error handling shared by the project tabs; renders `children` once data is there. */
export function TabState<T>({
  query,
  children,
}: {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
}) {
  if (query.isError) {
    return (
      <Card>
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </Card>
    );
  }
  if (!query.data) return <Skeleton className="h-48 w-full" />;
  return <div className="flex flex-col gap-6">{children(query.data)}</div>;
}

export function Figure({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md bg-surface-2 p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}
