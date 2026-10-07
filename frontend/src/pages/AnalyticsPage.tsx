import { AlertTriangle, Gauge, Zap } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '@/components/common/Badge';
import { Card, CardHeader } from '@/components/common/Card';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Skeleton } from '@/components/common/Skeleton';
import { StatCard } from '@/components/common/StatCard';
import { EmptyState, ErrorState } from '@/components/common/States';
import { CovenantStatusBadge } from '@/components/drawers/CovenantDetailDrawer';
import { PageHeader } from '@/components/layout/PageHeader';
import { usePortfolioPerformance } from '@/hooks/queries';
import type { PerformanceRow } from '@/types/api';
import { formatNPR, formatNumber, formatPercent, toNumber } from '@/utils/format';

/** Delivery below this share of contracted energy is flagged. */
const SHORTFALL_PCT = 95;

const sum = (rows: PerformanceRow[], pick: (row: PerformanceRow) => string | number | null) =>
  rows.reduce((total, row) => total + (toNumber(pick(row)) ?? 0), 0);

export default function AnalyticsPage() {
  const performance = usePortfolioPerformance();
  const rows = performance.data ?? [];
  const actual = sum(rows, (r) => r.actual_gwh);
  const contract = sum(rows, (r) => r.contract_gwh);
  const short = rows.filter((r) => (toNumber(r.delivery_pct) ?? 100) < SHORTFALL_PCT).length;

  const columns: Column<PerformanceRow>[] = [
    {
      key: 'project',
      header: 'Project',
      render: (row) => (
        <Link to={`/projects/${row.project_id}?tab=generation`} className="font-medium text-primary hover:underline">
          {row.project_name}
          <span className="block text-xs font-normal text-muted">
            {row.project_code} · {formatNumber(toNumber(row.installed_capacity_mw) ?? 0, 'en', 1)} MW
          </span>
        </Link>
      ),
    },
    {
      key: 'generation',
      header: 'Generation',
      align: 'right',
      render: (row) => (
        <>
          {formatNumber(toNumber(row.actual_gwh) ?? 0, 'en', 1)} GWh
          <span className="block text-xs text-muted">
            of {formatNumber(toNumber(row.contract_gwh) ?? 0, 'en', 1)} contracted
          </span>
        </>
      ),
    },
    {
      key: 'delivery',
      header: 'Delivery',
      align: 'right',
      render: (row) => {
        const low = (toNumber(row.delivery_pct) ?? 100) < SHORTFALL_PCT;
        return (
          <span className={low ? 'font-semibold text-warning' : ''}>
            {formatPercent(row.delivery_pct)}
            {low && <span className="sr-only"> (below contract)</span>}
          </span>
        );
      },
    },
    { key: 'plf', header: 'Plant load factor', align: 'right', hideOnMobile: true, render: (row) => formatPercent(row.avg_plf_pct) },
    { key: 'availability', header: 'Availability', align: 'right', hideOnMobile: true, render: (row) => formatPercent(row.avg_availability_pct) },
    { key: 'revenue', header: 'Revenue', align: 'right', hideOnMobile: true, render: (row) => formatNPR(row.revenue_npr) },
    {
      key: 'risks',
      header: 'Open risks',
      align: 'right',
      render: (row) =>
        row.open_risks === 0 ? (
          '—'
        ) : (
          <Badge tone={row.serious_risks > 0 ? 'danger' : 'neutral'}>
            {row.open_risks}
            {row.serious_risks > 0 && ` (${row.serious_risks} high)`}
          </Badge>
        ),
    },
    {
      key: 'covenants',
      header: 'Covenants',
      hideOnMobile: true,
      render: (row) => (row.covenant_status ? <CovenantStatusBadge status={row.covenant_status} /> : '—'),
    },
  ];

  const period = rows[0] ? `${rows[0].months} months to ${rows[0].last_month.slice(0, 7)}` : undefined;

  return (
    <>
      <PageHeader
        title="Analytics"
        description="What each operating plant generated against its contract, with plant performance and open risks"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Energy generated"
          icon={<Zap className="size-4" />}
          value={`${formatNumber(actual, 'en', 0)} GWh`}
          hint={period}
          loading={performance.isLoading}
        />
        <StatCard
          label="Delivery against contract"
          icon={<Gauge className="size-4" />}
          value={contract ? formatPercent((actual / contract) * 100) : '—'}
          hint={contract ? `${formatNumber(contract, 'en', 0)} GWh contracted` : undefined}
          loading={performance.isLoading}
        />
        <StatCard
          label={`Plants below ${SHORTFALL_PCT}% delivery`}
          icon={<AlertTriangle className="size-4" />}
          value={short}
          hint={`of ${rows.length} operating`}
          loading={performance.isLoading}
        />
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader
            title="Plant performance"
            description="Recorded months only, weakest delivery first. Nothing here is a forecast."
          />
          {performance.isError ? (
            <ErrorState error={performance.error} onRetry={() => void performance.refetch()} />
          ) : performance.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <DataTable
              caption="Plant performance by project"
              columns={columns}
              rows={rows}
              rowKey={(row) => row.project_id}
              empty={
                <EmptyState
                  title="No generation data"
                  description="Projects appear here once monthly generation is recorded."
                />
              }
            />
          )}
        </Card>
      </div>
    </>
  );
}
