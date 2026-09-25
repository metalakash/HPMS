import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { Skeleton } from './Skeleton';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right';
  /** Hide below the md breakpoint to keep tables readable on tablets/phones. */
  hideOnMobile?: boolean;
}

export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  loading = false,
  empty,
  onRowClick,
}: {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
}) {
  const cellClass = (column: Column<T>) =>
    cn(
      'px-4 py-3',
      column.align === 'right' && 'text-right tabular-nums',
      column.hideOnMobile && 'hidden md:table-cell',
    );

  if (!loading && rows.length === 0 && empty) return <>{empty}</>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-left text-muted">
            {columns.map((column) => (
              <th key={column.key} scope="col" className={cn(cellClass(column), 'font-medium')}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }, (_, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  {columns.map((column) => (
                    <td key={column.key} className={cellClass(column)}>
                      <Skeleton className="h-4 w-full max-w-32" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b border-line last:border-0',
                    onRowClick && 'cursor-pointer hover:bg-surface-2',
                  )}
                >
                  {columns.map((column) => (
                    <td key={column.key} className={cellClass(column)}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
