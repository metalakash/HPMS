import { Link, useNavigate, useSearchParams } from 'react-router';
import { Badge } from '@/components/common/Badge';
import { Card } from '@/components/common/Card';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Select } from '@/components/common/Field';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState } from '@/components/common/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { PROJECT_STAGES, useProjects } from '@/hooks/queries';
import { useUIStore } from '@/store/useUIStore';
import type { ProjectListItem } from '@/types/api';
import { formatDate, formatMW, humanize } from '@/utils/format';
import { projectName, statusTone } from '@/utils/status';

const PAGE_SIZE = 20;
const PIPELINE_STATUSES = ['proposal_under_pipeline', 'under_review', 'approved', 'dropped'];
const PROVINCES = ['Koshi', 'Madhesh', 'Bagmati', 'Gandaki', 'Lumbini', 'Karnali', 'Sudurpashchim'];

export default function ProjectsPage() {
  const language = useUIStore((s) => s.language);
  const navigate = useNavigate();
  // Filters live in the URL so views are shareable and survive reloads.
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const stage = params.get('stage') ?? '';
  const status = params.get('status') ?? '';
  const province = params.get('province') ?? '';

  const query = useProjects({ page, page_size: PAGE_SIZE, stage, status, province });

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

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
    { key: 'province', header: 'Province', hideOnMobile: true, render: (p) => p.province ?? '—' },
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
    {
      key: 'cod',
      header: 'Latest COD',
      hideOnMobile: true,
      render: (p) => (
        <span title={p.latest_cod_bs ? `${p.latest_cod_bs} BS` : undefined}>
          {formatDate(p.latest_cod_ad, language)}
        </span>
      ),
    },
  ];

  const hasFilters = Boolean(stage || status || province);

  return (
    <>
      <PageHeader title="Projects" description="Hydropower projects in the lending portfolio" />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select
          label="Stage"
          value={stage}
          onChange={(e) => update('stage', e.target.value)}
          placeholder="All stages"
          options={PROJECT_STAGES.map((s) => ({ value: s, label: humanize(s) }))}
        />
        <Select
          label="Pipeline status"
          value={status}
          onChange={(e) => update('status', e.target.value)}
          placeholder="All statuses"
          options={PIPELINE_STATUSES.map((s) => ({ value: s, label: humanize(s) }))}
        />
        <Select
          label="Province"
          value={province}
          onChange={(e) => update('province', e.target.value)}
          placeholder="All provinces"
          options={PROVINCES.map((p) => ({ value: p, label: p }))}
        />
      </div>

      <Card>
        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <>
            <DataTable
              caption="Projects"
              columns={columns}
              rows={query.data?.data ?? []}
              rowKey={(p) => p.id}
              loading={query.isLoading}
              onRowClick={(p) => navigate(`/projects/${p.id}`)}
              empty={
                <EmptyState
                  title={hasFilters ? 'No projects match these filters' : 'No projects yet'}
                  description={hasFilters ? 'Try clearing one of the filters.' : undefined}
                />
              }
            />
            {(query.data?.meta.total_count ?? 0) > 0 && (
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                totalCount={query.data?.meta.total_count ?? 0}
                onPageChange={(p) => update('page', String(p))}
              />
            )}
          </>
        )}
      </Card>
    </>
  );
}
