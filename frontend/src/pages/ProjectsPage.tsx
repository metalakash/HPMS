import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { OriginateProjectModal } from '@/components/OriginateProjectModal';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Input, Select } from '@/components/common/Field';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState } from '@/components/common/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { PROJECT_STAGES, useCatalog, useProjects } from '@/hooks/queries';
import { useAuthStore } from '@/store/useAuthStore';
import { useUIStore } from '@/store/useUIStore';
import type { CatalogProject, ProjectListItem } from '@/types/api';
import { cn } from '@/utils/cn';
import { formatDate, formatMW, humanize } from '@/utils/format';
import { PIPELINE_STATUSES, projectName, statusTone } from '@/utils/status';

const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 300;
const PROVINCES = ['Koshi', 'Madhesh', 'Bagmati', 'Gandaki', 'Lumbini', 'Karnali', 'Sudurpashchim'];

type View = 'portfolio' | 'catalog';
const VIEWS: { id: View; label: string }[] = [
  { id: 'portfolio', label: 'My Portfolio' },
  { id: 'catalog', label: 'National Catalog' },
];

export default function ProjectsPage() {
  // The view and filters live in the URL so views are shareable and survive reloads.
  const [params, setParams] = useSearchParams();
  const view: View = params.get('view') === 'catalog' ? 'catalog' : 'portfolio';

  // Two filters can change before the page re-renders, and the router builds each update from the params of
  // its last render. Keep the latest params here so the second change builds on the first.
  const latest = useRef(params);
  useEffect(() => {
    latest.current = params;
  }, [params]);

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(latest.current);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    latest.current = next;
    setParams(next);
  };

  const switchView = (next: View) => {
    const fresh = new URLSearchParams();
    if (next === 'catalog') fresh.set('view', 'catalog');
    latest.current = fresh;
    setParams(fresh);
  };

  return (
    <>
      <PageHeader
        title="Projects"
        description={
          view === 'portfolio'
            ? "The bank's financed projects and its pipeline"
            : 'Verified national hydropower records, used to originate new loans and to benchmark'
        }
      />

      <div role="tablist" aria-label="Project lists" className="mb-4 flex gap-1 border-b border-line">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            id={`projects-tab-${v.id}`}
            aria-selected={view === v.id}
            aria-controls="projects-tabpanel"
            onClick={() => switchView(v.id)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
              view === v.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-fg',
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div id="projects-tabpanel" role="tabpanel" aria-labelledby={`projects-tab-${view}`}>
        {view === 'portfolio' ? (
          <PortfolioView params={params} update={update} />
        ) : (
          <CatalogView params={params} update={update} />
        )}
      </div>
    </>
  );
}

interface ViewProps {
  params: URLSearchParams;
  update: (key: string, value: string) => void;
}

function PortfolioView({ params, update }: ViewProps) {
  const language = useUIStore((s) => s.language);
  const navigate = useNavigate();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const stage = params.get('stage') ?? '';
  const status = params.get('status') ?? '';
  const province = params.get('province') ?? '';

  const query = useProjects({ page, page_size: PAGE_SIZE, stage, status, province });

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
                  description={
                    hasFilters
                      ? 'Try clearing one of the filters.'
                      : 'Propose a project from the National Catalog to start the bank’s pipeline.'
                  }
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

function CatalogView({ params, update }: ViewProps) {
  const language = useUIStore((s) => s.language);
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const canOriginate = roles.includes('maker') || roles.includes('admin');

  const page = Math.max(1, Number(params.get('page')) || 1);
  const stage = params.get('stage') ?? '';
  const province = params.get('province') ?? '';
  const q = params.get('q') ?? '';

  // Typing is kept locally and written to the URL after a pause, so each keystroke is not a request.
  const [search, setSearch] = useState(q);
  useEffect(() => {
    if (search.trim() === q) return;
    const timer = setTimeout(() => update('q', search.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
    // `update` is rebuilt on each render; only the typed text and the applied query matter here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, q]);

  const [proposing, setProposing] = useState<CatalogProject | null>(null);
  const [proposed, setProposed] = useState<string | null>(null);

  const query = useCatalog({ page, page_size: PAGE_SIZE, q, stage, province });

  const columns: Column<CatalogProject>[] = [
    {
      key: 'name',
      header: 'Project',
      render: (p) => (
        <div>
          <p className="font-medium">{projectName(p, language)}</p>
          <p className="text-xs text-muted">{p.project_code}</p>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      hideOnMobile: true,
      render: (p) => [p.district, p.province].filter(Boolean).join(', ') || '—',
    },
    {
      key: 'capacity',
      header: 'Capacity',
      align: 'right',
      render: (p) => formatMW(p.installed_capacity_mw, language),
    },
    {
      key: 'basin',
      header: 'River basin',
      hideOnMobile: true,
      render: (p) => p.river_basin ?? '—',
    },
    {
      key: 'licence',
      header: 'DoED licence',
      hideOnMobile: true,
      render: (p) => (
        <div>
          <p>{p.license_number ?? '—'}</p>
          {p.license_status && <p className="text-xs text-muted">{humanize(p.license_status)}</p>}
        </div>
      ),
    },
    { key: 'stage', header: 'Stage', hideOnMobile: true, render: (p) => humanize(p.project_stage) },
    ...(canOriginate
      ? [
          {
            key: 'action',
            header: '',
            align: 'right' as const,
            render: (p: CatalogProject) => (
              <Button
                size="sm"
                variant="secondary"
                aria-label={`Propose ${p.name_en} for financing`}
                onClick={() => {
                  setProposed(null);
                  setProposing(p);
                }}
              >
                Propose
              </Button>
            ),
          },
        ]
      : []),
  ];

  const hasFilters = Boolean(q || stage || province);

  return (
    <>
      {proposed && (
        <p role="status" className="mb-4 rounded-md bg-success-soft p-3 text-sm text-success">
          {proposed} was proposed for financing. It joins your portfolio as a proposal under
          pipeline once two checkers approve it.{' '}
          <Link to="/approvals" className="font-medium underline">
            View approvals
          </Link>
        </p>
      )}

      {proposing && (
        <OriginateProjectModal
          project={proposing}
          language={language}
          onClose={() => setProposing(null)}
          onSubmitted={(p) => setProposed(p.name_en)}
        />
      )}

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input
          label="Search the catalog"
          type="search"
          value={search}
          placeholder="Name, code, district or licence number"
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          label="Stage"
          value={stage}
          onChange={(e) => update('stage', e.target.value)}
          placeholder="All stages"
          options={PROJECT_STAGES.map((s) => ({ value: s, label: humanize(s) }))}
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
              caption="National hydro directory"
              columns={columns}
              rows={query.data?.data ?? []}
              rowKey={(p) => p.id}
              loading={query.isLoading}
              empty={
                <EmptyState
                  title={hasFilters ? 'No catalog projects match' : 'The catalog is empty'}
                  description={hasFilters ? 'Try a different name, code or licence number.' : undefined}
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
