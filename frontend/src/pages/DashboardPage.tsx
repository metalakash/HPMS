import { Link, useNavigate } from 'react-router';
import { Activity, Banknote, FolderKanban } from 'lucide-react';
import { Badge } from '@/components/common/Badge';
import { Card, CardHeader } from '@/components/common/Card';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatCard } from '@/components/common/StatCard';
import { EmptyState, ErrorState } from '@/components/common/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { useLoanAccounts, useProjects, useStageCounts } from '@/hooks/queries';
import { useAuthStore } from '@/store/useAuthStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useUIStore } from '@/store/useUIStore';
import type { ProjectListItem } from '@/types/api';
import { formatCompact, formatDate, formatMW, humanize } from '@/utils/format';
import { projectName, statusTone } from '@/utils/status';

const RECENT_COUNT = 5;

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const language = useUIStore((s) => s.language);
  const navigate = useNavigate();

  const recent = useProjects({ page: 1, page_size: RECENT_COUNT });
  const loans = useLoanAccounts({ page: 1, page_size: 1 });
  const stages = useStageCounts();

  const columns: Column<ProjectListItem>[] = [
    {
      key: 'name',
      header: 'Project',
      render: (p) => (
        <div>
          <Link
            to={`/projects/${p.id}`}
            className="font-medium hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {projectName(p, language)}
          </Link>
          <p className="text-xs text-muted">{p.project_code}</p>
        </div>
      ),
    },
    {
      key: 'capacity',
      header: 'Capacity',
      align: 'right',
      render: (p) => formatMW(p.installed_capacity_mw, language),
    },
    { key: 'stage', header: 'Stage', hideOnMobile: true, render: (p) => humanize(p.project_stage) },
    {
      key: 'status',
      header: 'Pipeline status',
      render: (p) => (
        <Badge tone={statusTone(p.pipeline_status)}>{humanize(p.pipeline_status)}</Badge>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Portfolio overview"
        description={`Welcome back${user?.full_name ? `, ${user.full_name}` : ''}.`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Projects"
          icon={<FolderKanban className="size-4" />}
          loading={recent.isLoading}
          value={formatCompact(recent.data?.meta.total_count ?? null, language)}
        />
        <StatCard
          label="Loan accounts"
          icon={<Banknote className="size-4" />}
          loading={loans.isLoading}
          value={formatCompact(loans.data?.meta.total_count ?? null, language)}
        />
        {stages.counts.map(({ stage, count }) => (
          <StatCard
            key={stage}
            label={`In ${stage}`}
            loading={stages.isLoading}
            value={formatCompact(count, language)}
          />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Recently added projects"
            actions={
              <Link to="/projects" className="text-sm font-medium text-primary hover:underline">
                View all
              </Link>
            }
          />
          {recent.isError ? (
            <ErrorState error={recent.error} onRetry={() => void recent.refetch()} />
          ) : (
            <DataTable
              caption="Recently added projects"
              columns={columns}
              rows={recent.data?.data ?? []}
              rowKey={(p) => p.id}
              loading={recent.isLoading}
              onRowClick={(p) => navigate(`/projects/${p.id}`)}
              empty={<EmptyState title="No projects yet" />}
            />
          )}
        </Card>

        <LiveActivity />
      </div>
    </>
  );
}

function LiveActivity() {
  const items = useNotificationStore((s) => s.items);
  const status = useNotificationStore((s) => s.status);
  const language = useUIStore((s) => s.language);

  return (
    <Card>
      <CardHeader
        title="Live activity"
        description={status === 'open' ? 'Connected' : 'Not connected'}
      />
      {items.length === 0 ? (
        <EmptyState
          icon={<Activity className="size-8" />}
          title="No events yet"
          description="Project, loan and rate changes appear here as they happen."
        />
      ) : (
        <ul className="divide-y divide-line">
          {items.slice(0, 8).map((item) => (
            <li key={item.id} className="px-4 py-3">
              <p className="text-sm font-medium">{item.title ?? humanize(item.type)}</p>
              {item.message && <p className="text-sm text-muted">{item.message}</p>}
              <p className="mt-0.5 text-xs text-muted">{formatDate(item.timestamp, language)}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
