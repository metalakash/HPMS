/**
 * CBSSyncButton: On-demand CBS Finacle sync with diff log display
 */

import { useState } from 'react';
import { Zap, AlertCircle, CheckCircle, ChevronDown } from 'lucide-react';
import { Spinner } from '@/components/common/Spinner';
import { apiClient } from '@/services/api';

interface CBSSyncDiff {
  field: string;
  previous_value: string | number;
  new_value: string | number;
  status: 'changed' | 'same';
}

interface CBSSyncButtonProps {
  projectId: string;
  loanId: string;
  onSyncComplete?: () => void;
}

/**
 * CBS Sync Button with diff log
 */
export function CBSSyncButton({ projectId, loanId, onSyncComplete }: CBSSyncButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [diffLog, setDiffLog] = useState<CBSSyncDiff[] | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  const handleSync = async () => {
    setIsLoading(true);
    setError('');
    setDiffLog(null);

    try {
      const response = await apiClient.post(`/cbs/sync/${projectId}`, {
        loan_id: loanId,
      });

      // Mock diff log for now
      const mockDiff: CBSSyncDiff[] = [
        {
          field: 'outstanding_principal',
          previous_value: 850000000,
          new_value: 842000000,
          status: 'changed',
        },
        {
          field: 'overdue_amount',
          previous_value: 0,
          new_value: 0,
          status: 'same',
        },
        {
          field: 'last_repayment_date',
          previous_value: '2026-09-15',
          new_value: '2026-09-15',
          status: 'same',
        },
      ];

      setDiffLog(mockDiff);
      setShowDiff(true);
      onSyncComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CBS sync failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        onClick={handleSync}
        disabled={isLoading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? (
          <Spinner className="size-4" />
        ) : (
          <Zap className="size-4" />
        )}
        {isLoading ? 'Syncing...' : 'Sync Account Now'}
      </button>

      {error && (
        <div className="flex gap-2 rounded-lg bg-danger/10 p-3 text-sm text-danger">
          <AlertCircle className="size-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {diffLog && (
        <div className="rounded-lg border border-line bg-surface-2">
          <button
            onClick={() => setShowDiff(!showDiff)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface transition-colors"
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="size-4 text-success" />
              <span className="font-medium text-fg">Sync successful</span>
              <span className="text-xs text-muted">
                {diffLog.filter(d => d.status === 'changed').length} changes
              </span>
            </div>
            <ChevronDown
              className={`size-4 text-muted transition-transform ${
                showDiff ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showDiff && (
            <div className="border-t border-line px-4 py-3 space-y-2">
              {diffLog.map((item) => (
                <div
                  key={item.field}
                  className={`text-sm p-2 rounded ${
                    item.status === 'changed'
                      ? 'bg-warning/10 text-warning'
                      : 'bg-success/10 text-success'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium capitalize">{item.field.replace(/_/g, ' ')}</span>
                    {item.status === 'changed' && (
                      <span className="text-xs">Updated</span>
                    )}
                  </div>
                  {item.status === 'changed' && (
                    <div className="mt-1 flex gap-2 text-xs">
                      <span className="line-through opacity-70">{item.previous_value}</span>
                      <span className="font-semibold">→ {item.new_value}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
