import { AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '@/components/common/Badge';
import { Card, CardHeader } from '@/components/common/Card';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Skeleton } from '@/components/common/Skeleton';
import { StatCard } from '@/components/common/StatCard';
import { EmptyState, ErrorState } from '@/components/common/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { usePortfolioMaintenance } from '@/hooks/queries';
import type { MaintenanceCompleted, MaintenanceUpcoming } from '@/types/api';
import { formatDate, formatNPR, formatNumber, humanize, toNumber } from '@/utils/format';

function ProjectLink({ row }: { row: { project_id: string; project_name: string; project_code: string } }) {
  return (
    <Link to={`/projects/${row.project_id}`} className="font-medium text-primary hover:underline">
      {row.project_name}
      <span className="block text-xs font-normal text-muted">{row.project_code}</span>
    </Link>
  );
}

const mwh = (value: string | null) => {
  const n = toNumber(value);
  return n === null ? '—' : `${formatNumber(n, 'en', 0)} MWh`;
};
const hours = (value: number | null) => (value === null ? '—' : `${value} h`);

const UPCOMING: Column<MaintenanceUpcoming>[] = [
  { key: 'project', header: 'Project', render: (row) => <ProjectLink row={row} /> },
  { key: 'equipment', header: 'Equipment', render: (row) => row.equipment_name },
  { key: 'type', header: 'Type', hideOnMobile: true, render: (row) => humanize(row.maintenance_type) },
  {
    key: 'date',
    header: 'Scheduled',
    render: (row) => (
      <>
        {formatDate(row.scheduled_date_ad)}
        {row.scheduled_date_bs && <span className="block text-xs text-muted">{row.scheduled_date_bs} BS</span>}
      </>
    ),
  },
  { key: 'duration', header: 'Outage', align: 'right', hideOnMobile: true, render: (row) => hours(row.estimated_duration_hours) },
  { key: 'impact', header: 'Generation at risk', align: 'right', hideOnMobile: true, render: (row) => mwh(row.estimated_impact_mwh) },
  {
    key: 'status',
    header: 'Status',
    render: (row) =>
      row.overdue ? (
        <Badge tone="danger">Overdue</Badge>
      ) : (
        <Badge tone={row.status === 'in_progress' ? 'info' : 'neutral'}>{humanize(row.status)}</Badge>
      ),
  },
];

const COMPLETED: Column<MaintenanceCompleted>[] = [
  { key: 'project', header: 'Project', render: (row) => <ProjectLink row={row} /> },
  { key: 'equipment', header: 'Equipment', render: (row) => row.equipment_name },
  { key: 'type', header: 'Type', render: (row) => humanize(row.maintenance_type) },
  { key: 'date', header: 'Completed', render: (row) => formatDate(row.actual_date_ad) },
  { key: 'duration', header: 'Outage', align: 'right', hideOnMobile: true, render: (row) => hours(row.duration_hours) },
  { key: 'downtime', header: 'Generation lost', align: 'right', hideOnMobile: true, render: (row) => mwh(row.downtime_mwh) },
  { key: 'cost', header: 'Cost', align: 'right', render: (row) => formatNPR(row.cost_npr) },
];

export default function MaintenancePage() {
  const maintenance = usePortfolioMaintenance();
  const upcoming = maintenance.data?.upcoming ?? [];
  const completed = maintenance.data?.completed ?? [];
  const cost = completed.reduce((total, row) => total + (toNumber(row.cost_npr) ?? 0), 0);
  const corrective = completed.filter((row) => row.maintenance_type === 'corrective').length;

  const body = (table: React.ReactNode) =>
    maintenance.isError ? (
      <ErrorState error={maintenance.error} onRetry={() => void maintenance.refetch()} />
    ) : maintenance.isLoading ? (
      <Skeleton className="h-40 w-full" />
    ) : (
      table
    );

  return (
    <>
      <PageHeader
        title="Maintenance"
        description="Planned outages and completed work across the operating plants"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Scheduled"
          icon={<Clock className="size-4" />}
          value={upcoming.length}
          hint={`${upcoming.filter((row) => row.overdue).length} overdue`}
          loading={maintenance.isLoading}
        />
        <StatCard
          label="Completed in the last year"
          icon={<CheckCircle className="size-4" />}
          value={completed.length}
          hint={`${corrective} corrective`}
          loading={maintenance.isLoading}
        />
        <StatCard
          label="Maintenance cost, last year"
          icon={<AlertCircle className="size-4" />}
          value={formatNPR(cost)}
          loading={maintenance.isLoading}
        />
      </div>

      <div className="mt-6 flex flex-col gap-6">
        <Card>
          <CardHeader title="Upcoming work" description="Soonest first" />
          {body(
            <DataTable
              caption="Upcoming maintenance"
              columns={UPCOMING}
              rows={upcoming}
              rowKey={(row) => row.id}
              empty={<EmptyState title="Nothing scheduled" />}
            />,
          )}
        </Card>
        <Card>
          <CardHeader title="Completed work" description="Latest first" />
          {body(
            <DataTable
              caption="Completed maintenance"
              columns={COMPLETED}
              rows={completed}
              rowKey={(row) => row.id}
              empty={<EmptyState title="No completed work in the last year" />}
            />,
          )}
        </Card>
      </div>
    </>
  );
}
