import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { AxiosError } from 'axios';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/common/Badge';
import { Card, CardBody, CardHeader } from '@/components/common/Card';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Skeleton } from '@/components/common/Skeleton';
import { EmptyState, ErrorState } from '@/components/common/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { useProject, useProjectLoans } from '@/hooks/queries';
import { useUIStore } from '@/store/useUIStore';
import type { CodHistoryEntry, LoanAccountListItem } from '@/types/api';
import { formatDate, formatMW, formatNPR, formatPercent, humanize } from '@/utils/format';
import { projectName, statusTone } from '@/utils/status';

export default function ProjectDetailPage() {
  const { id = '' } = useParams();
  const language = useUIStore((s) => s.language);
  const project = useProject(id);
  const loans = useProjectLoans(id);

  const back = (
    <Link
      to="/projects"
      className="mb-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
    >
      <ArrowLeft className="size-4" aria-hidden="true" /> All projects
    </Link>
  );

  if (project.isError) {
    const notFound = project.error instanceof AxiosError && project.error.response?.status === 404;
    return (
      <>
        {back}
        <Card>
          {notFound ? (
            <EmptyState title="Project not found" description="It may have been removed." />
          ) : (
            <ErrorState error={project.error} onRetry={() => void project.refetch()} />
          )}
        </Card>
      </>
    );
  }

  const p = project.data?.data;

  const codColumns: Column<CodHistoryEntry>[] = [
    { key: 'type', header: 'Type', render: (c) => humanize(c.cod_type) },
    { key: 'ad', header: 'Date (AD)', render: (c) => formatDate(c.date_ad, language) },
    { key: 'bs', header: 'Date (BS)', render: (c) => c.date_bs ?? '—' },
    { key: 'version', header: 'Version', align: 'right', render: (c) => c.version },
    { key: 'source', header: 'Source', hideOnMobile: true, render: (c) => humanize(c.source) },
  ];

  const loanColumns: Column<LoanAccountListItem>[] = [
    { key: 'facility', header: 'Facility', render: (l) => humanize(l.facility_type) },
    {
      key: 'sanctioned',
      header: 'Sanctioned',
      align: 'right',
      render: (l) => formatNPR(l.sanctioned_amount, language),
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
      key: 'sync',
      header: 'CBS sync',
      render: (l) => <Badge tone={statusTone(l.sync_status)}>{humanize(l.sync_status)}</Badge>,
    },
  ];

  return (
    <>
      {back}
      {p ? (
        <PageHeader
          title={projectName(p, language)}
          description={`${p.project_code} · ${p.location.district}, ${p.location.province}`}
          actions={
            <Badge tone={statusTone(p.pipeline_status)}>{humanize(p.pipeline_status)}</Badge>
          }
        />
      ) : (
        <Skeleton className="mb-6 h-12 w-72" />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Details" />
          <CardBody>
            {p ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Detail
                  label="Installed capacity"
                  value={formatMW(p.installed_capacity_mw, language)}
                />
                <Detail label="Stage" value={humanize(p.project_stage)} />
                <Detail label="Local level" value={p.location.local_level ?? '—'} />
                <Detail label="Documents" value={p.documents_count} />
                <Detail label="Loan accounts" value={p.loan_accounts_count} />
                <Detail label="Updated" value={formatDate(p.updated_at, language)} />
                {p.drop_reason && <Detail label="Drop reason" value={p.drop_reason} wide />}
              </dl>
            ) : (
              <Skeleton className="h-40 w-full" />
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Commercial operation date history" />
          <DataTable
            caption="COD history"
            columns={codColumns}
            rows={p?.cod_history ?? []}
            rowKey={(c) => `${c.cod_type}-${c.version}`}
            loading={project.isLoading}
            empty={<EmptyState title="No COD dates recorded" />}
          />
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader title="Loan accounts" />
          {loans.isError ? (
            <ErrorState error={loans.error} onRetry={() => void loans.refetch()} />
          ) : (
            <DataTable
              caption="Loan accounts for this project"
              columns={loanColumns}
              rows={loans.data?.data ?? []}
              rowKey={(l) => l.id}
              loading={loans.isLoading}
              empty={<EmptyState title="No loan accounts linked" />}
            />
          )}
        </Card>
      </div>
    </>
  );
}

function Detail({ label, value, wide }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : undefined}>
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
