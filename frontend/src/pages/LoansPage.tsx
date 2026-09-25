import { useSearchParams } from 'react-router';
import { Badge } from '@/components/common/Badge';
import { Card } from '@/components/common/Card';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Select } from '@/components/common/Field';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState } from '@/components/common/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { useLoanAccounts } from '@/hooks/queries';
import { useUIStore } from '@/store/useUIStore';
import type { LoanAccountListItem } from '@/types/api';
import { formatDate, formatNPR, formatPercent, humanize } from '@/utils/format';
import { statusTone } from '@/utils/status';

const PAGE_SIZE = 20;
const SYNC_STATUSES = ['pending', 'success', 'failed'];

export default function LoansPage() {
  const language = useUIStore((s) => s.language);
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const status = params.get('status') ?? '';

  const query = useLoanAccounts({ page, page_size: PAGE_SIZE, status });

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  const columns: Column<LoanAccountListItem>[] = [
    {
      key: 'project',
      header: 'Project',
      render: (l) => (
        <div>
          <p className="font-medium">{l.project_code}</p>
          <p className="text-xs text-muted">{humanize(l.facility_type)}</p>
        </div>
      ),
    },
    {
      key: 'sanctioned',
      header: 'Sanctioned',
      align: 'right',
      render: (l) => formatNPR(l.sanctioned_amount, language),
    },
    {
      key: 'disbursed',
      header: 'Disbursed',
      align: 'right',
      hideOnMobile: true,
      render: (l) => formatNPR(l.disbursed_amount, language),
    },
    {
      key: 'outstanding',
      header: 'Outstanding',
      align: 'right',
      hideOnMobile: true,
      render: (l) => formatNPR(l.outstanding_principal, language),
    },
    {
      key: 'rate',
      header: 'Rate',
      align: 'right',
      render: (l) => formatPercent(l.current_rate_pct, language),
    },
    {
      key: 'maturity',
      header: 'Maturity',
      hideOnMobile: true,
      render: (l) => formatDate(l.maturity_ad, language),
    },
    {
      key: 'sync',
      header: 'CBS sync',
      render: (l) => <Badge tone={statusTone(l.sync_status)}>{humanize(l.sync_status)}</Badge>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Loan accounts"
        description="Facilities synced from the core banking system"
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select
          label="CBS sync status"
          value={status}
          onChange={(e) => update('status', e.target.value)}
          placeholder="All"
          options={SYNC_STATUSES.map((s) => ({ value: s, label: humanize(s) }))}
        />
      </div>

      <Card>
        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <>
            <DataTable
              caption="Loan accounts"
              columns={columns}
              rows={query.data?.data ?? []}
              rowKey={(l) => l.id}
              loading={query.isLoading}
              empty={
                <EmptyState
                  title={status ? 'No loan accounts with this status' : 'No loan accounts yet'}
                />
              }
            />
            {(query.data?.meta.total_count ?? 0) > 0 && (
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                totalCount={query.data?.meta.total_count ?? 0}
                onPageChange={(p) => update('page', String(p))}
              />
            )}
          </>
        )}
      </Card>
    </>
  );
}
