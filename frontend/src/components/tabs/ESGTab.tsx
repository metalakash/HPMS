import { Card, CardBody, CardHeader } from '@/components/common/Card';
import { DataTable, type Column } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/States';
import { useEsg } from '@/hooks/queries';
import type { EsgData } from '@/types/api';
import { formatDate, formatNumber, formatPercent, humanize } from '@/utils/format';
import { Figure, TabState } from './TabState';

type Measure = EsgData['eia_mitigation']['measures'][number];

const measureColumns: Column<Measure>[] = [
  { key: 'measure', header: 'Measure', render: (m) => m.measure },
  { key: 'status', header: 'Status', hideOnMobile: true, render: (m) => humanize(m.status) },
  {
    key: 'completion',
    header: 'Complete',
    align: 'right',
    render: (m) => formatPercent(m.completion_pct),
  },
];

/** Environmental and social metrics and EIA mitigation measures, from the esg endpoint. */
export function ESGTab({ projectId }: { projectId: string }) {
  const query = useEsg(projectId);
  return (
    <TabState query={query}>
      {(data) => (
        <>
          <Card>
            <CardHeader
              title="Environmental and social metrics"
              description={
                data.metrics_as_of ? `As of ${formatDate(data.metrics_as_of)}` : undefined
              }
            />
            {data.metrics_as_of ? (
              <CardBody>
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <Figure
                    label="CO₂ avoided per year"
                    value={`${formatNumber(data.environmental.co2_avoided_tonnes_per_year)} t`}
                  />
                  <Figure
                    label="Carbon credits generated"
                    value={formatNumber(data.environmental.carbon_credits_generated)}
                  />
                  <Figure
                    label="Local employment"
                    value={formatNumber(data.social.local_employment_count)}
                  />
                  <Figure
                    label="Community grievances"
                    value={formatNumber(data.social.community_grievance_count)}
                  />
                  <Figure
                    label="Grievances resolved"
                    value={formatPercent(data.social.grievance_resolution_rate_pct)}
                  />
                </dl>
              </CardBody>
            ) : (
              <EmptyState title="No ESG metrics recorded" />
            )}
          </Card>

          <Card>
            <CardHeader
              title="EIA mitigation measures"
              description={
                data.eia_mitigation.total_measures > 0
                  ? `${data.eia_mitigation.completed_measures} of ${data.eia_mitigation.total_measures} complete`
                  : undefined
              }
            />
            <DataTable
              caption="EIA mitigation measures"
              columns={measureColumns}
              rows={data.eia_mitigation.measures}
              rowKey={(m) => m.id}
              empty={<EmptyState title="No mitigation measures recorded" />}
            />
          </Card>
        </>
      )}
    </TabState>
  );
}
