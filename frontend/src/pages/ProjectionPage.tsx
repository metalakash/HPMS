import { ArrowDownToLine, ArrowUpFromLine, Landmark, TrendingUp } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '@/components/common/Badge';
import { Card, CardHeader } from '@/components/common/Card';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Skeleton } from '@/components/common/Skeleton';
import { StatCard } from '@/components/common/StatCard';
import { EmptyState, ErrorState } from '@/components/common/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { useLoanProjection } from '@/hooks/queries';
import { useUIStore } from '@/store/useUIStore';
import type { ProjectionBorrower, ProjectionQuarter } from '@/types/api';
import { formatDate, formatNPR, humanize, toNumber } from '@/utils/format';
import { statusTone } from '@/utils/status';

const total = (quarters: ProjectionQuarter[], pick: (q: ProjectionQuarter) => string) =>
  quarters.reduce((sum, q) => sum + (toNumber(pick(q)) ?? 0), 0);

export default function ProjectionPage() {
  const language = useUIStore((s) => s.language);
  const projection = useLoanProjection();
  const quarters = projection.data?.quarters ?? [];
  const borrowers = projection.data?.projects ?? [];
  const opening = quarters[0];
  const closing = quarters[quarters.length - 1];
  const today = new Date().toISOString().slice(0, 10);
  const hasNewLoans = quarters.some((q) => (toNumber(q.new_loan_disbursement) ?? 0) > 0);
  const peak = Math.max(0, ...quarters.map((q) => toNumber(q.outstanding_with_new_loans ?? q.outstanding) ?? 0));

  const quarterColumns: Column<ProjectionQuarter>[] = [
    {
      key: 'quarter',
      header: 'Quarter',
      render: (q) => (
        <>
          <span className="font-medium">
            FY {q.fiscal_year} · {q.label}
          </span>
          <span className="block text-xs text-muted">
            {q.period_end_bs} BS · {formatDate(q.period_end_ad, language)}
          </span>
        </>
      ),
    },
    {
      key: 'state',
      header: 'Status',
      hideOnMobile: true,
      render: (q) =>
        q.is_opening ? (
          <Badge tone="neutral">Opening position</Badge>
        ) : q.period_end_ad < today ? (
          <Badge tone="neutral">Date passed</Badge>
        ) : (
          '—'
        ),
    },
    {
      key: 'disbursement',
      header: 'Disbursement',
      align: 'right',
      render: (q) => (q.is_opening ? '—' : formatNPR(q.disbursement, language)),
    },
    {
      key: 'repayment',
      header: 'Repayment',
      align: 'right',
      render: (q) => (q.is_opening ? '—' : formatNPR(q.repayment, language)),
    },
    {
      key: 'outstanding',
      header: 'Outstanding at quarter end',
      align: 'right',
      render: (q) => {
        const value = toNumber(q.outstanding) ?? 0;
        return (
          <>
            {formatNPR(q.outstanding, language)}
            <span className="mt-1 block h-1 rounded bg-line" aria-hidden="true">
              <span
                className="block h-1 rounded bg-primary"
                style={{ width: `${peak ? (value / peak) * 100 : 0}%` }}
              />
            </span>
          </>
        );
      },
    },
  ];
  if (hasNewLoans) {
    quarterColumns.push({
      key: 'new-loans',
      header: 'With planned new loans',
      align: 'right',
      hideOnMobile: true,
      render: (q) =>
        q.is_opening || q.outstanding_with_new_loans === null ? (
          '—'
        ) : (
          <>
            {formatNPR(q.outstanding_with_new_loans, language)}
            <span className="block text-xs text-muted">
              {(toNumber(q.new_loan_disbursement) ?? 0) > 0
                ? `+${formatNPR(q.new_loan_disbursement, language)} this quarter`
                : 'none this quarter'}
            </span>
          </>
        ),
    });
  }

  const borrowerColumns: Column<ProjectionBorrower>[] = [
    {
      key: 'project',
      header: 'Borrower',
      render: (b) => (
        <Link to={`/projects/${b.project_id}`} className="font-medium text-primary hover:underline">
          {b.project_name}
          <span className="block text-xs font-normal text-muted">{b.project_code}</span>
        </Link>
      ),
    },
    {
      key: 'status',
      header: 'Pipeline status',
      hideOnMobile: true,
      render: (b) => <Badge tone={statusTone(b.pipeline_status)}>{humanize(b.pipeline_status)}</Badge>,
    },
    {
      key: 'limit',
      header: 'Limit',
      align: 'right',
      hideOnMobile: true,
      render: (b) => formatNPR(b.sanctioned_amount, language),
    },
    { key: 'opening', header: 'Opening', align: 'right', render: (b) => formatNPR(b.opening_outstanding, language) },
    {
      key: 'disbursement',
      header: 'To disburse',
      align: 'right',
      render: (b) => formatNPR(b.total_disbursement, language),
    },
    {
      key: 'repayment',
      header: 'To repay',
      align: 'right',
      hideOnMobile: true,
      render: (b) => formatNPR(b.total_repayment, language),
    },
    { key: 'closing', header: 'Closing', align: 'right', render: (b) => formatNPR(b.closing_outstanding, language) },
  ];

  const horizon = closing ? `to ${closing.label} FY ${closing.fiscal_year}` : undefined;

  return (
    <>
      <PageHeader
        title="Loan projection"
        description="The quarterly plan for the hydropower book: what is due to be disbursed and repaid, and the outstanding that leaves"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Opening outstanding"
          icon={<Landmark className="size-4" />}
          value={opening ? formatNPR(opening.outstanding, language) : '—'}
          hint={opening ? `as on ${opening.period_end_bs} BS` : undefined}
          loading={projection.isLoading}
        />
        <StatCard
          label="Planned disbursement"
          icon={<ArrowUpFromLine className="size-4" />}
          value={quarters.length ? formatNPR(total(quarters, (q) => q.disbursement), language) : '—'}
          hint={horizon}
          loading={projection.isLoading}
        />
        <StatCard
          label="Planned repayment"
          icon={<ArrowDownToLine className="size-4" />}
          value={quarters.length ? formatNPR(total(quarters, (q) => q.repayment), language) : '—'}
          hint={horizon}
          loading={projection.isLoading}
        />
        <StatCard
          label="Closing outstanding"
          icon={<TrendingUp className="size-4" />}
          value={closing ? formatNPR(closing.outstanding, language) : '—'}
          hint={closing ? `${borrowers.length} borrowers` : undefined}
          loading={projection.isLoading}
        />
      </div>

      {projection.isError ? (
        <div className="mt-6">
          <Card>
            <ErrorState error={projection.error} onRetry={() => void projection.refetch()} />
          </Card>
        </div>
      ) : (
        <>
          <div className="mt-6">
            <Card>
              <CardHeader
                title="By quarter"
                description={`The plan as it was prepared from the opening position. Quarters whose date has passed are not compared with what happened.${hasNewLoans ? ' The last column adds lending the bank plans but has not yet approved.' : ''}`}
              />
              {projection.isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <DataTable
                  caption="Projected disbursement, repayment and outstanding by fiscal quarter"
                  columns={quarterColumns}
                  rows={quarters}
                  rowKey={(q) => q.period_end_ad}
                  empty={
                    <EmptyState
                      title="No projection on file"
                      description="Quarters appear here once a loan projection is loaded."
                    />
                  }
                />
              )}
            </Card>
          </div>

          {borrowers.length > 0 && (
            <div className="mt-6">
              <Card>
                <CardHeader
                  title="By borrower"
                  description="Totals over the whole projection, largest planned disbursement first."
                />
                <DataTable
                  caption="Projection by borrower"
                  columns={borrowerColumns}
                  rows={borrowers}
                  rowKey={(b) => b.project_id}
                />
              </Card>
            </div>
          )}
        </>
      )}
    </>
  );
}
