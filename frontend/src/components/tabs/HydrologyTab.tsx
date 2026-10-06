import { Badge, type BadgeTone } from '@/components/common/Badge';
import { Card, CardBody, CardHeader } from '@/components/common/Card';
import { DataTable, type Column } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/States';
import { useHydrology } from '@/hooks/queries';
import type { WaterLicense } from '@/types/api';
import { formatDate, formatNumber, humanize } from '@/utils/format';
import { Figure, TabState } from './TabState';

const LICENSE_TONES: Record<string, BadgeTone> = {
  valid: 'success',
  expiring_soon: 'warning',
  expired: 'danger',
};

const licenseColumns: Column<WaterLicense>[] = [
  { key: 'number', header: 'Licence', render: (l) => l.license_number ?? '—' },
  {
    key: 'authority',
    header: 'Issued by',
    hideOnMobile: true,
    render: (l) => l.issuing_authority ?? '—',
  },
  {
    key: 'from',
    header: 'Valid from',
    hideOnMobile: true,
    render: (l) => formatDate(l.validity_from),
  },
  { key: 'to', header: 'Valid to', render: (l) => formatDate(l.validity_to) },
  {
    key: 'status',
    header: 'Status',
    render: (l) => <Badge tone={LICENSE_TONES[l.status] ?? 'neutral'}>{humanize(l.status)}</Badge>,
  },
];

const flow = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : `${formatNumber(value)} m³/s`;

/** River basin characteristics and water licences, from the hydrology endpoint. */
export function HydrologyTab({ projectId }: { projectId: string }) {
  const query = useHydrology(projectId);
  return (
    <TabState query={query}>
      {(data) => {
        const h = data.hydrology;
        return (
          <>
            <Card>
              <CardHeader title="River basin" />
              {h.river_basin ? (
                <CardBody>
                  <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <Figure label="River basin" value={h.river_basin} />
                    <Figure
                      label="Design discharge (Q90)"
                      value={flow(h.design_discharge_q90_m3s)}
                    />
                    <Figure label="Median flow (Q50)" value={flow(h.median_flow_q50_m3s)} />
                    <Figure
                      label="Catchment area"
                      value={
                        h.catchment_area_sqkm ? `${formatNumber(h.catchment_area_sqkm)} km²` : '—'
                      }
                    />
                  </dl>
                </CardBody>
              ) : (
                <EmptyState title="No hydrology data recorded" />
              )}
            </Card>

            <Card>
              <CardHeader
                title="Water licences"
                description={
                  data.licenses_expiring_soon > 0
                    ? `${data.licenses_expiring_soon} expiring soon`
                    : undefined
                }
              />
              <DataTable
                caption="Water licences"
                columns={licenseColumns}
                rows={data.water_licenses}
                rowKey={(l) => `${l.license_number}-${l.validity_from}`}
                empty={<EmptyState title="No water licences recorded" />}
              />
            </Card>
          </>
        );
      }}
    </TabState>
  );
}
