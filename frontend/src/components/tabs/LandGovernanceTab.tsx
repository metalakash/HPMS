import { Card, CardBody, CardHeader } from '@/components/common/Card';
import { DataTable, type Column } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/States';
import { useLandGovernance } from '@/hooks/queries';
import type { LandGovernanceData } from '@/types/api';
import { formatDate, formatNPR, formatNumber, formatPercent, humanize } from '@/utils/format';
import { Figure, TabState } from './TabState';

type Director = LandGovernanceData['board_of_directors']['members'][number];
type Shareholder = LandGovernanceData['shareholding']['shareholders'][number];

const directorColumns: Column<Director>[] = [
  { key: 'name', header: 'Director', render: (d) => d.director_name },
  { key: 'title', header: 'Title', render: (d) => d.title ?? '—' },
  {
    key: 'appointed',
    header: 'Appointed',
    hideOnMobile: true,
    render: (d) => formatDate(d.appointment_date),
  },
];

const shareholderColumns: Column<Shareholder>[] = [
  { key: 'entity', header: 'Shareholder', render: (s) => s.entity_name },
  { key: 'type', header: 'Type', hideOnMobile: true, render: (s) => humanize(s.entity_type) },
  { key: 'share', header: 'Share', align: 'right', render: (s) => formatPercent(s.share_pct) },
];

/** Land acquisition progress, board and shareholding, from the land-governance endpoint. */
export function LandGovernanceTab({ projectId }: { projectId: string }) {
  const query = useLandGovernance(projectId);
  return (
    <TabState query={query}>
      {(data) => {
        const land = data.land_acquisition;
        return (
          <>
            <Card>
              <CardHeader title="Land acquisition" />
              {land.total_area_required_ropani > 0 ? (
                <CardBody>
                  <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <Figure
                      label="Required"
                      value={`${formatNumber(land.total_area_required_ropani)} ropani`}
                    />
                    <Figure
                      label={`Acquired (${formatPercent(land.acquisition_pct)})`}
                      value={`${formatNumber(land.total_area_acquired_ropani)} ropani`}
                    />
                    <Figure
                      label="Compensation paid"
                      value={formatNPR(land.compensation_paid_npr)}
                    />
                    <Figure
                      label="Compensation outstanding"
                      value={formatNPR(land.compensation_outstanding_npr)}
                    />
                  </dl>
                </CardBody>
              ) : (
                <EmptyState title="No land acquisition data recorded" />
              )}
            </Card>

            <Card>
              <CardHeader title="Board of directors" />
              <DataTable
                caption="Board of directors"
                columns={directorColumns}
                rows={data.board_of_directors.members}
                rowKey={(d) => d.director_name}
                empty={<EmptyState title="No directors recorded" />}
              />
            </Card>

            <Card>
              <CardHeader title="Shareholding" />
              <DataTable
                caption="Shareholding"
                columns={shareholderColumns}
                rows={data.shareholding.shareholders}
                rowKey={(s) => s.entity_name}
                empty={<EmptyState title="No shareholders recorded" />}
              />
            </Card>
          </>
        );
      }}
    </TabState>
  );
}
