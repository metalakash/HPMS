import { useState } from 'react';
import { AlertCircle, AlertTriangle, Check } from 'lucide-react';
import { Card, CardHeader } from '@/components/common/Card';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Skeleton } from '@/components/common/Skeleton';
import { StatCard } from '@/components/common/StatCard';
import { EmptyState, ErrorState } from '@/components/common/States';
import {
  CovenantDetailDrawer,
  CovenantStatusBadge,
  formatRatio,
} from '@/components/drawers/CovenantDetailDrawer';
import { PageHeader } from '@/components/layout/PageHeader';
import { useCovenantResults } from '@/hooks/queries';
import type { CovenantMetric, CovenantResultRow } from '@/types/api';
import { formatDate, formatFiscalQuarter, humanize } from '@/utils/format';

function Ratio({ metric, unit }: { metric: CovenantMetric; unit: 'x' | '%' }) {
  const tone =
    metric.status === 'breached' ? 'text-danger' : metric.status === 'warning' ? 'text-warning' : '';
  return (
    <span className={`tabular-nums ${tone} ${tone && 'font-semibold'}`}>
      {formatRatio(metric, unit)}
      {tone && <span className="sr-only"> ({metric.status})</span>}
    </span>
  );
}

export default function CompliancePage() {
  const results = useCovenantResults();
  const [selected, setSelected] = useState<CovenantResultRow | null>(null);
  const rows = results.data ?? [];
  const count = (status: CovenantResultRow['overall_status']) =>
    rows.filter((row) => row.overall_status === status).length;

  const columns: Column<CovenantResultRow>[] = [
    {
      key: 'project',
      header: 'Project',
      render: (row) => (
        <button
          type="button"
          onClick={() => setSelected(row)}
          className="text-left font-medium text-primary hover:underline"
        >
          {row.project_name}
          <span className="block text-xs font-normal text-muted">{row.project_code}</span>
        </button>
      ),
    },
    { key: 'stage', header: 'Stage', hideOnMobile: true, render: (row) => humanize(row.project_stage) },
    { key: 'dscr', header: 'DSCR', align: 'right', render: (row) => <Ratio metric={row.dscr} unit="x" /> },
    { key: 'icr', header: 'ICR', align: 'right', render: (row) => <Ratio metric={row.icr} unit="x" /> },
    { key: 'ltv', header: 'LTV', align: 'right', render: (row) => <Ratio metric={row.ltv} unit="%" /> },
    { key: 'status', header: 'Status', render: (row) => <CovenantStatusBadge status={row.overall_status} /> },
    {
      key: 'tested',
      header: 'Tested at',
      hideOnMobile: true,
      render: (row) => (
        <>
          {formatFiscalQuarter(row.quarter)}
          <span className="block text-xs text-muted">{formatDate(row.test_date)}</span>
        </>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Compliance"
        description="Covenant tests calculated from each borrower's reported financials and loan schedule"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Projects tested"
          icon={<Check className="size-4" />}
          value={rows.length}
          loading={results.isLoading}
        />
        <StatCard
          label="In breach"
          icon={<AlertCircle className="size-4" />}
          value={count('breached')}
          loading={results.isLoading}
        />
        <StatCard
          label="Close to a limit"
          icon={<AlertTriangle className="size-4" />}
          value={count('warning')}
          loading={results.isLoading}
        />
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader
            title="Covenant status"
            description="Latest test per project, breaches first. Select a project to see the calculation and its history."
          />
          {results.isError ? (
            <ErrorState error={results.error} onRetry={() => void results.refetch()} />
          ) : results.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <DataTable
              caption="Latest covenant test per project"
              columns={columns}
              rows={rows}
              rowKey={(row) => row.project_id}
              empty={
                <EmptyState
                  title="No covenant tests yet"
                  description="Results appear once a project's quarterly financials are recorded."
                />
              }
            />
          )}
        </Card>
      </div>

      {selected && (
        <CovenantDetailDrawer
          isOpen
          onClose={() => setSelected(null)}
          projectId={selected.project_id}
          projectName={selected.project_name}
        />
      )}
    </>
  );
}
