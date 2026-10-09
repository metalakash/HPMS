import { AlertTriangle, Gauge, Landmark, Scale } from 'lucide-react';
import { Badge } from '@/components/common/Badge';
import { Card, CardHeader } from '@/components/common/Card';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Skeleton } from '@/components/common/Skeleton';
import { StatCard } from '@/components/common/StatCard';
import { EmptyState, ErrorState } from '@/components/common/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { useEnergyFinancing } from '@/hooks/queries';
import { useUIStore } from '@/store/useUIStore';
import type { EnergyBond, EnergyFinancingQuarter, NewLoanLimit } from '@/types/api';
import { formatDate, formatNPR, formatPercent, toNumber } from '@/utils/format';

const quarterName = (q: EnergyFinancingQuarter) => `${q.label} FY ${q.fiscal_year}`;

export default function EnergyFinancingPage() {
  const language = useUIStore((s) => s.language);
  const query = useEnergyFinancing();
  const quarters = query.data?.quarters ?? [];
  const bonds = query.data?.bonds ?? [];
  const pipeline = query.data?.pipeline;
  const hasPipeline = (pipeline?.quarters.length ?? 0) > 0;
  const today = new Date().toISOString().slice(0, 10);

  // The position that matters today: the latest quarter end already reached
  const reached = quarters.filter((q) => q.period_end_ad <= today);
  const current = reached[reached.length - 1] ?? quarters[0];
  const firstShortfall = quarters.find((q) => q.status === 'shortfall' && q.period_end_ad > today);
  const firstShortfallWithNewLoans = quarters.find(
    (q) => q.with_pipeline?.status === 'shortfall' && q.period_end_ad > today,
  );
  const headroom = toNumber(current?.headroom);

  const quarterColumns: Column<EnergyFinancingQuarter>[] = [
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
      key: 'basis',
      header: 'Basis',
      hideOnMobile: true,
      render: (q) => <Badge tone="neutral">{q.is_actual ? 'Recorded' : 'Projected'}</Badge>,
    },
    {
      key: 'hydro',
      header: 'Hydropower loans',
      align: 'right',
      hideOnMobile: true,
      render: (q) => formatNPR(q.hydro_outstanding, language),
    },
    {
      key: 'bonds',
      header: 'Energy bonds',
      align: 'right',
      hideOnMobile: true,
      render: (q) => formatNPR(q.energy_bonds, language),
    },
    {
      key: 'base',
      header: 'Bank loans six months earlier',
      align: 'right',
      hideOnMobile: true,
      render: (q) => formatNPR(q.base_loans, language),
    },
    {
      key: 'ratio',
      header: 'Energy share',
      align: 'right',
      render: (q) => <span className="font-medium">{formatPercent(q.ratio_pct, language)}</span>,
    },
    {
      key: 'minimum',
      header: 'Minimum',
      align: 'right',
      render: (q) => (q.required_pct ? formatPercent(q.required_pct, language) : '—'),
    },
    {
      key: 'headroom',
      header: 'Headroom',
      align: 'right',
      render: (q) =>
        q.headroom === null ? (
          '—'
        ) : q.status === 'shortfall' ? (
          <Badge tone="danger">Short by {formatNPR(Math.abs(toNumber(q.headroom) ?? 0), language)}</Badge>
        ) : (
          formatNPR(q.headroom, language)
        ),
    },
  ];
  if (hasPipeline) {
    quarterColumns.push({
      key: 'pipeline',
      header: 'With planned new loans',
      align: 'right',
      render: (q) => {
        const scenario = q.with_pipeline;
        if (!scenario || q.is_actual || scenario.ratio_pct === null) return '—';
        return (
          <>
            <span className="font-medium">{formatPercent(scenario.ratio_pct, language)}</span>
            <span className="block text-xs text-muted">
              {scenario.status === 'shortfall'
                ? `short by ${formatNPR(Math.abs(toNumber(scenario.headroom) ?? 0), language)}`
                : (toNumber(scenario.new_loans_outstanding) ?? 0) > 0
                  ? `+${formatNPR(scenario.new_loans_outstanding, language)} lent`
                  : 'none drawn yet'}
            </span>
          </>
        );
      },
    });
  }

  const limitColumns: Column<NewLoanLimit>[] = [
    { key: 'year', header: 'Approved in', render: (l) => <span className="font-medium">FY {l.fiscal_year}</span> },
    {
      key: 'drawdown',
      header: 'Drawn over the following years',
      hideOnMobile: true,
      render: (l) => (l.drawdown_pct ? l.drawdown_pct.map((share) => `${share}%`).join(' · ') : '—'),
    },
    { key: 'limit', header: 'New limit', align: 'right', render: (l) => formatNPR(l.new_limit, language) },
  ];

  const bondColumns: Column<EnergyBond>[] = [
    {
      key: 'name',
      header: 'Bond',
      render: (b) => <span className="font-medium">{b.name}</span>,
    },
    {
      key: 'invested',
      header: 'Invested',
      hideOnMobile: true,
      render: (b) => formatDate(b.investment_date_ad, language),
    },
    {
      key: 'matures',
      header: 'Matures',
      render: (b) => (
        <>
          {formatDate(b.maturity_date_ad, language)}
          {!b.held && (
            <span className="ml-2">
              <Badge tone="neutral">Not held</Badge>
            </span>
          )}
        </>
      ),
    },
    { key: 'yield', header: 'Yield', align: 'right', render: (b) => formatPercent(b.yield_pct, language) },
    { key: 'amount', header: 'Amount', align: 'right', render: (b) => formatNPR(b.amount, language) },
  ];

  return (
    <>
      <PageHeader
        title="Energy financing"
        description="Hydropower loans and energy bonds as a share of the bank's lending, against the regulator's minimum"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Energy share of lending"
          icon={<Gauge className="size-4" />}
          value={current ? formatPercent(current.ratio_pct, language) : '—'}
          hint={current ? `${quarterName(current)} · ${current.is_actual ? 'recorded' : 'projected'}` : undefined}
          loading={query.isLoading}
        />
        <StatCard
          label={headroom !== null && headroom < 0 ? 'Shortfall against the minimum' : 'Headroom over the minimum'}
          icon={<Scale className="size-4" />}
          value={headroom === null ? '—' : formatNPR(Math.abs(headroom), language)}
          hint={current?.required_pct ? `minimum ${formatPercent(current.required_pct, language)}` : 'no minimum in force'}
          loading={query.isLoading}
        />
        <StatCard
          label="Energy bonds held"
          icon={<Landmark className="size-4" />}
          value={query.data ? formatNPR(query.data.bonds_held, language) : '—'}
          hint={`${bonds.filter((b) => b.held).length} bonds`}
          loading={query.isLoading}
        />
        <StatCard
          label="Next quarter below the minimum"
          icon={<AlertTriangle className="size-4" />}
          value={firstShortfall ? quarterName(firstShortfall) : 'None on file'}
          hint={
            hasPipeline
              ? `with planned new loans: ${firstShortfallWithNewLoans ? quarterName(firstShortfallWithNewLoans) : 'none on file'}`
              : firstShortfall
                ? `${formatPercent(firstShortfall.ratio_pct, language)} against ${formatPercent(firstShortfall.required_pct, language)}`
                : undefined
          }
          loading={query.isLoading}
        />
      </div>

      {query.isError ? (
        <div className="mt-6">
          <Card>
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          </Card>
        </div>
      ) : (
        <>
          <div className="mt-6">
            <Card>
              <CardHeader
                title="By quarter"
                description="Energy share is hydropower loans plus energy bonds, over the bank's total loans six months earlier. Recorded quarters use the bank's own figures; projected quarters use the loan projection and the bond register."
              />
              {query.isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <DataTable
                  caption="Energy financing against the regulatory minimum by fiscal quarter"
                  columns={quarterColumns}
                  rows={quarters}
                  rowKey={(q) => q.period_end_ad}
                  empty={
                    <EmptyState
                      title="No energy financing figures on file"
                      description="Quarters appear here once the bank's total loans and the regulatory minimum are loaded."
                    />
                  }
                />
              )}
            </Card>
          </div>

          {pipeline && pipeline.limits.length > 0 && (
            <div className="mt-6">
              <Card>
                <CardHeader
                  title="Planned new loans"
                  description={`Limits the bank plans to approve but has not yet sanctioned: ${formatNPR(pipeline.total_limit, language)} in all, with ${formatNPR(pipeline.total_disbursement, language)} of disbursement scheduled. They count only in the "with planned new loans" column.`}
                />
                <DataTable
                  caption="Planned new loan limits"
                  columns={limitColumns}
                  rows={pipeline.limits}
                  rowKey={(l) => l.fiscal_year}
                />
              </Card>
            </div>
          )}

          {bonds.length > 0 && (
            <div className="mt-6">
              <Card>
                <CardHeader title="Energy bonds" description="A bond counts from its investment date until it matures." />
                <DataTable caption="Energy bonds" columns={bondColumns} rows={bonds} rowKey={(b) => b.id} />
              </Card>
            </div>
          )}
        </>
      )}
    </>
  );
}
