import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, RefreshCw } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { queryKeys } from '@/hooks/queries';
import { getErrorMessage } from '@/services/api';
import { cbsApi } from '@/services/endpoints';
import type { CbsDiffEntry } from '@/types/api';
import { cn } from '@/utils/cn';
import { humanize } from '@/utils/format';

interface CBSSyncButtonProps {
  projectId: string;
  /** The loan account's own id. */
  loanId: string;
  onSyncComplete?: () => void;
}

const show = (value: CbsDiffEntry['new_value']) =>
  value === null || value === '' ? '—' : String(value);

/** On-demand comparison of one loan with the core banking system, with the field-by-field result. */
export function CBSSyncButton({ projectId, loanId, onSyncComplete }: CBSSyncButtonProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(true);

  const sync = useMutation({
    mutationFn: () => cbsApi.sync(projectId, loanId),
    onSuccess: (result) => {
      if (result.status !== 'success') return;
      setOpen(true);
      if (result.applied) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.loans });
      }
      onSyncComplete?.();
    },
  });

  const result = sync.data;
  const failure = sync.isError
    ? getErrorMessage(sync.error)
    : result && result.status !== 'success'
      ? (result.error ?? 'The core banking system returned no data for this account')
      : '';
  const changed = result?.diff_log.filter((d) => d.status === 'changed') ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => sync.mutate()}
          loading={sync.isPending}
        >
          {!sync.isPending && <RefreshCw className="size-4" aria-hidden="true" />}
          {sync.isPending ? 'Syncing…' : 'Sync with CBS'}
        </Button>
      </div>

      {failure && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md bg-danger-soft p-3 text-sm text-danger"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {failure}
        </div>
      )}

      {result?.status === 'success' && (
        <div className="rounded-md border border-line text-sm">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-surface-2"
          >
            <span className="font-medium">
              {changed.length === 0
                ? 'No differences from CBS'
                : `${changed.length} ${changed.length === 1 ? 'field differs' : 'fields differ'} from CBS`}
            </span>
            <ChevronDown
              className={cn('size-4 text-muted transition-transform', open && 'rotate-180')}
              aria-hidden="true"
            />
          </button>

          {open && (
            <div className="border-t border-line px-3 py-2">
              {result.simulated ? (
                <p className="mb-2 text-warning">
                  Simulated: no Finacle connection is configured, so this compares against the
                  built-in sample record. No balances were changed.
                </p>
              ) : (
                <p className="mb-2 text-muted">
                  {result.applied
                    ? 'The loan was updated with the CBS values.'
                    : 'The loan already matches CBS.'}
                </p>
              )}
              <table className="w-full border-collapse">
                <caption className="sr-only">CBS comparison</caption>
                <thead>
                  <tr className="text-left text-muted">
                    <th scope="col" className="py-1 pr-3 font-medium">
                      Field
                    </th>
                    <th scope="col" className="py-1 pr-3 font-medium">
                      HPMS
                    </th>
                    <th scope="col" className="py-1 font-medium">
                      CBS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.diff_log.map((entry) => (
                    <tr key={entry.field} className="border-t border-line">
                      <th scope="row" className="py-1 pr-3 text-left font-normal">
                        {humanize(entry.field)}
                      </th>
                      <td className="py-1 pr-3 tabular-nums">{show(entry.previous_value)}</td>
                      <td
                        className={cn(
                          'py-1 tabular-nums',
                          entry.status === 'changed' && 'font-semibold text-warning',
                        )}
                      >
                        {show(entry.new_value)}
                        {entry.status === 'changed' && <span className="sr-only"> (differs)</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
