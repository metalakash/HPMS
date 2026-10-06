import { Badge } from '@/components/common/Badge';
import { Card, CardBody, CardHeader } from '@/components/common/Card';
import { DataTable, type Column } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/States';
import { useGenerationPpa } from '@/hooks/queries';
import type { GenerationMonth } from '@/types/api';
import {
  formatDate,
  formatNPR,
  formatNumber,
  formatPercent,
  humanize,
  toNumber,
} from '@/utils/format';
import { Figure, TabState } from './TabState';

const columns: Column<GenerationMonth>[] = [
  {
    key: 'month',
    header: 'Month',
    render: (m) => (
      <span title={m.month_bs ? `${m.month_bs} BS` : undefined}>{formatDate(m.month)}</span>
    ),
  },
  {
    key: 'season',
    header: 'Season',
    hideOnMobile: true,
    render: (m) => (
      <Badge tone={m.season === 'wet' ? 'info' : 'neutral'}>{humanize(m.season)}</Badge>
    ),
  },
  {
    key: 'contract',
    header: 'Contract (MWh)',
    align: 'right',
    render: (m) => formatNumber(m.contract_mwh),
  },
  {
    key: 'actual',
    header: 'Actual (MWh)',
    align: 'right',
    render: (m) => formatNumber(m.actual_mwh),
  },
  {
    key: 'variance',
    header: 'Variance',
    align: 'right',
    render: (m) => (
      <span className={(toNumber(m.variance_pct) ?? 0) < 0 ? 'text-danger' : undefined}>
        {formatPercent(m.variance_pct)}
      </span>
    ),
  },
  {
    key: 'revenue',
    header: 'Revenue',
    align: 'right',
    hideOnMobile: true,
    render: (m) => formatNPR(m.revenue_npr),
  },
];

/** Power purchase agreement and monthly generation against contract, from the generation-ppa endpoint. */
export function GenerationPPATab({ projectId }: { projectId: string }) {
  const query = useGenerationPpa(projectId);
  return (
    <TabState query={query}>
      {(data) => (
        <>
          <Card>
            <CardHeader title="Power purchase agreement" />
            {data.ppa?.agreement_number ? (
              <CardBody>
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <Figure label="Agreement" value={data.ppa.agreement_number} />
                  <Figure label="Purchaser" value={data.ppa.purchaser ?? '—'} />
                  <Figure label="Tariff type" value={data.ppa.tariff_type ?? '—'} />
                  <Figure
                    label="Annual escalation"
                    value={formatPercent(data.ppa.escalation_pct)}
                  />
                </dl>
              </CardBody>
            ) : (
              <EmptyState title="No power purchase agreement recorded" />
            )}
          </Card>

          <Card>
            <CardHeader
              title="Monthly generation"
              description={
                data.summary.months_available > 0
                  ? `${data.summary.months_available} months · ${formatNumber(data.summary.total_generated_mwh)} MWh generated · ${formatNPR(data.summary.total_revenue_npr)} revenue`
                  : undefined
              }
            />
            <DataTable
              caption="Monthly generation"
              columns={columns}
              rows={data.monthly_data}
              rowKey={(m) => m.month ?? m.month_bs ?? ''}
              empty={<EmptyState title="No generation data recorded" />}
            />
          </Card>
        </>
      )}
    </TabState>
  );
}
