import { useState } from 'react';
import { Download, Play, Save, Trash2 } from 'lucide-react';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card, CardBody, CardHeader } from '@/components/common/Card';
import { Input, Select } from '@/components/common/Field';
import { Skeleton } from '@/components/common/Skeleton';
import { EmptyState, ErrorState } from '@/components/common/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { getErrorMessage } from '@/services/api';
import {
  cleanFilters,
  reportsApi,
  useDeleteReport,
  useReportDefinitions,
  useReportSources,
  useSaveReport,
  type ReportDefinition,
  type ReportFileFormat,
  type ReportFilters,
  type ReportPreview,
  type ReportRequest,
} from '@/services/reporting';
import { useAuthStore } from '@/store/useAuthStore';
import { humanize } from '@/utils/format';

const PROVINCES = ['Koshi', 'Madhesh', 'Bagmati', 'Gandaki', 'Lumbini', 'Karnali', 'Sudurpashchim'];
const FORMATS: { value: ReportFileFormat; label: string }[] = [
  { value: 'excel', label: 'Excel' },
  { value: 'csv', label: 'CSV' },
  { value: 'word', label: 'Word' },
];
const PREVIEW_ROWS = 25;

const cell = (value: unknown) => (value === null || value === undefined || value === '' ? '—' : String(value));

function PreviewTable({ preview, columns }: { preview: ReportPreview; columns: string[] }) {
  if (preview.record_count === 0) {
    return <EmptyState title="No rows" description="Nothing matches these filters." />;
  }
  const shown = columns.length ? columns : Object.keys(preview.data[0]);
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Report preview</caption>
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              {shown.map((name) => (
                <th key={name} scope="col" className="whitespace-nowrap px-4 py-2 font-medium">
                  {humanize(name)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.data.slice(0, PREVIEW_ROWS).map((row, index) => (
              <tr key={index} className="border-b border-line last:border-0">
                {shown.map((name) => (
                  <td key={name} className="whitespace-nowrap px-4 py-2">
                    {cell(row[name])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-4 py-2 text-xs text-muted">
        {preview.record_count > PREVIEW_ROWS
          ? `Showing the first ${PREVIEW_ROWS} of ${preview.record_count} rows. Download for all of them.`
          : `${preview.record_count} ${preview.record_count === 1 ? 'row' : 'rows'}`}
      </p>
    </>
  );
}

export default function ReportsPage() {
  const sources = useReportSources();
  const definitions = useReportDefinitions();
  const saveReport = useSaveReport();
  const deleteReport = useDeleteReport();
  const username = useAuthStore((state) => state.user?.username);
  const isAdmin = useAuthStore((state) => state.user?.roles.includes('admin') ?? false);

  const [sourceKey, setSourceKey] = useState('');
  const [columns, setColumns] = useState<string[]>([]);
  const [filters, setFilters] = useState<ReportFilters>({});
  const [format, setFormat] = useState<ReportFileFormat>('excel');
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [busy, setBusy] = useState<'preview' | 'download' | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null);

  const source = sources.data?.find((s) => s.key === (sourceKey || sources.data?.[0]?.key));
  const request: ReportRequest | null = source
    ? { source: source.key, columns: columns.length ? columns : null, filters: cleanFilters(filters) }
    : null;

  function load(next: { source: string; columns: string[] | null; filters: ReportFilters | null }) {
    setSourceKey(next.source);
    setColumns(next.columns ?? []);
    setFilters(next.filters ?? {});
    setPreview(null);
    setMessage(null);
  }

  async function run(action: 'preview' | 'download', what: ReportRequest | null = request, title = name) {
    if (!what) return;
    setBusy(action);
    setMessage(null);
    try {
      if (action === 'preview') setPreview(await reportsApi.preview(what));
      else await reportsApi.download(what, format, title.trim() || what.source);
    } catch (error) {
      // A file request for a report with no rows is answered with 404
      const empty = action === 'download' && (error as { response?: { status?: number } }).response?.status === 404;
      setMessage({ tone: 'error', text: empty ? 'Nothing matches these filters, so there is no file to download.' : getErrorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!request || !name.trim()) return;
    setMessage(null);
    try {
      await saveReport.mutateAsync({ ...request, name: name.trim(), is_shared: shared });
      setMessage({ tone: 'ok', text: `Saved "${name.trim()}".` });
      setName('');
    } catch (error) {
      setMessage({ tone: 'error', text: getErrorMessage(error) });
    }
  }

  function open(definition: ReportDefinition) {
    load(definition);
    void run('preview', { source: definition.source, columns: definition.columns, filters: definition.filters });
  }

  const toggle = (column: string) =>
    setColumns((current) => (current.includes(column) ? current.filter((c) => c !== column) : [...current, column]));
  const setFilter = (key: keyof ReportFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));

  return (
    <>
      <PageHeader title="Reports" description="Build a report from the portfolio data, preview it, download it or save it for later" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Build a report" />
          <CardBody className="flex flex-col gap-4">
            {sources.isError ? (
              <ErrorState error={sources.error} onRetry={() => void sources.refetch()} />
            ) : !source ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <>
                <Select
                  label="Report on"
                  value={source.key}
                  onChange={(event) => load({ source: event.target.value, columns: null, filters: null })}
                  options={(sources.data ?? []).map((s) => ({ value: s.key, label: s.label }))}
                />

                <fieldset>
                  <legend className="text-sm font-medium">Columns</legend>
                  <p className="text-xs text-muted">Leave all unticked to include every column.</p>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                    {source.columns.map((column) => (
                      <label key={column} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={columns.includes(column)} onChange={() => toggle(column)} />
                        {humanize(column)}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {source.filters.includes('province') && (
                    <Select
                      label="Filter by province"
                      placeholder="All provinces"
                      value={filters.province ?? ''}
                      onChange={(event) => setFilter('province', event.target.value)}
                      options={PROVINCES.map((p) => ({ value: p, label: p }))}
                    />
                  )}
                  {source.filters.includes('district') && (
                    <Input label="Filter by district" value={filters.district ?? ''} onChange={(event) => setFilter('district', event.target.value)} />
                  )}
                  {source.filters.includes('date_range_start') && (
                    <Input label="From" type="date" value={filters.date_range_start ?? ''} onChange={(event) => setFilter('date_range_start', event.target.value)} />
                  )}
                  {source.filters.includes('date_range_end') && (
                    <Input label="To" type="date" value={filters.date_range_end ?? ''} onChange={(event) => setFilter('date_range_end', event.target.value)} />
                  )}
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <Button onClick={() => void run('preview')} loading={busy === 'preview'}>
                    <Play className="size-4" aria-hidden="true" /> Preview
                  </Button>
                  <Select
                    label="File format"
                    value={format}
                    onChange={(event) => setFormat(event.target.value as ReportFileFormat)}
                    options={FORMATS}
                    className="w-32"
                  />
                  <Button variant="secondary" onClick={() => void run('download')} loading={busy === 'download'}>
                    <Download className="size-4" aria-hidden="true" /> Download
                  </Button>
                </div>

                <div className="flex flex-wrap items-end gap-3 border-t border-line pt-4">
                  <Input label="Save as" placeholder="Report name" value={name} onChange={(event) => setName(event.target.value)} className="min-w-56 flex-1" />
                  <label className="flex h-10 items-center gap-2 text-sm">
                    <input type="checkbox" checked={shared} onChange={(event) => setShared(event.target.checked)} />
                    Share with other users
                  </label>
                  <Button variant="secondary" onClick={() => void save()} disabled={!name.trim()} loading={saveReport.isPending}>
                    <Save className="size-4" aria-hidden="true" /> Save
                  </Button>
                </div>

                {message && (
                  <p role={message.tone === 'error' ? 'alert' : 'status'} className={`text-sm ${message.tone === 'error' ? 'text-danger' : 'text-success'}`}>
                    {message.text}
                  </p>
                )}
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Saved reports" description="Yours, and those shared with you" />
          {definitions.isError ? (
            <ErrorState error={definitions.error} onRetry={() => void definitions.refetch()} />
          ) : !definitions.data ? (
            <Skeleton className="h-32 w-full" />
          ) : definitions.data.length === 0 ? (
            <EmptyState title="No saved reports" description="Build one and save it to find it here." />
          ) : (
            <ul className="divide-y divide-line">
              {definitions.data.map((definition) => (
                <li key={definition.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <button type="button" onClick={() => open(definition)} className="text-left font-medium text-primary hover:underline">
                      {definition.name}
                    </button>
                    <p className="text-xs text-muted">
                      {sources.data?.find((s) => s.key === definition.source)?.label ?? definition.source} · by {definition.owner}
                    </p>
                    {definition.is_shared && <Badge tone="info">Shared</Badge>}
                  </div>
                  {(definition.owner === username || isAdmin) && (
                    <button
                      type="button"
                      aria-label={`Delete ${definition.name}`}
                      onClick={() => deleteReport.mutate(definition.id)}
                      className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-danger"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {preview && (
        <Card className="mt-6">
          <CardHeader title="Preview" description={sources.data?.find((s) => s.key === preview.source)?.label} />
          <PreviewTable preview={preview} columns={columns} />
        </Card>
      )}
    </>
  );
}
