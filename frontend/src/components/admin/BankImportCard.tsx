import { useState } from 'react';
import { Link } from 'react-router';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card, CardBody, CardHeader } from '@/components/common/Card';
import { DataTable, type Column } from '@/components/common/DataTable';
import { JustificationModal } from '@/components/modals/JustificationModal';
import { getErrorMessage } from '@/services/api';
import { type BankImport, type ImportStatusRow, type ImportTotal, useBankImports, usePreviewBankImport } from '@/services/bankImport';
import { useProposeChange } from '@/services/changeRequests';
import { formatDate, formatMW, formatNPR, formatNumber, humanize } from '@/utils/format';

const FIELD_LABELS: Record<ImportTotal['field'], string> = {
  mw: 'Capacity',
  limit: 'Approved limit',
  outstanding: 'Principal outstanding',
};

const asField = (field: ImportTotal['field'], value: string | null) => (field === 'mw' ? formatMW(value) : formatNPR(value));

const TOTAL_COLUMNS: Column<ImportTotal>[] = [
  { key: 'field', header: 'Total', render: (t) => FIELD_LABELS[t.field] },
  { key: 'parsed', header: 'Sum of the rows', align: 'right', render: (t) => asField(t.field, t.parsed) },
  { key: 'workbook', header: "Workbook's total row", align: 'right', render: (t) => asField(t.field, t.workbook) },
  {
    key: 'matches',
    header: 'Check',
    render: (t) => <Badge tone={t.matches ? 'success' : 'danger'}>{t.matches ? 'Matches' : 'Differs'}</Badge>,
  },
];

const STATUS_COLUMNS: Column<ImportStatusRow>[] = [
  { key: 'status', header: 'Status', render: (s) => humanize(s.status) },
  { key: 'count', header: 'Facilities', align: 'right', render: (s) => s.count },
  { key: 'mw', header: 'Capacity', align: 'right', render: (s) => formatMW(s.mw) },
  { key: 'limit', header: 'Limit', align: 'right', hideOnMobile: true, render: (s) => formatNPR(s.limit) },
  { key: 'outstanding', header: 'Outstanding', align: 'right', hideOnMobile: true, render: (s) => formatNPR(s.outstanding) },
  {
    key: 'legend',
    header: 'Workbook legend says',
    align: 'right',
    render: (s) =>
      s.workbook_count === null ? '—' : (
        <span className={s.workbook_count !== s.count ? 'font-medium text-warning' : undefined}>
          {s.workbook_count} · {formatMW(s.workbook_mw)}
        </span>
      ),
  },
];

function requestBadge(upload: BankImport) {
  if (upload.status === 'applied') return <Badge tone="success">Loaded</Badge>;
  if (!upload.request) return <Badge tone="neutral">Checked, not submitted</Badge>;
  const state = upload.request.state;
  if (state === 'rejected') return <Badge tone="danger">Rejected</Badge>;
  return <Badge tone="warning">Waiting for approval ({humanize(state)})</Badge>;
}

function Summary({ upload }: { upload: BankImport }) {
  const s = upload.summary;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{upload.projection_filename}</span>
        <span className="text-muted">and</span>
        <span className="font-medium">{upload.generation_filename}</span>
        <span className="text-muted">
          · uploaded by {upload.uploaded_by} {upload.uploaded_at ? `on ${formatDate(upload.uploaded_at)}` : ''}
        </span>
        {requestBadge(upload)}
      </div>

      <p className="text-sm">
        <Badge tone={s.agrees ? 'success' : 'danger'}>{s.agrees ? 'Adds up' : 'Does not add up'}</Badge>
        <span className="ml-2">
          {s.borrowers} borrowers, {s.as_of.replace('Principal Outst as on', 'position as on')}.
          {!s.agrees && ' The rows must add up to the workbook\'s own totals before it can be loaded.'}
        </span>
      </p>

      <DataTable caption="Totals against the workbook" columns={TOTAL_COLUMNS} rows={s.totals} rowKey={(t) => t.field} />
      <DataTable caption="Facilities by status (from the row colours)" columns={STATUS_COLUMNS} rows={s.statuses} rowKey={(r) => r.status} />

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">Quarterly projection</dt>
          <dd>
            {s.projection.quarters} quarters{s.projection.first && `, ${s.projection.first} to ${s.projection.last}`}, for{' '}
            {s.projection.borrowers} borrowers
          </dd>
        </div>
        <div>
          <dt className="text-muted">Energy bonds</dt>
          <dd>
            {s.bonds.count} bonds, {formatNPR(s.bonds.amount)}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Energy financing inputs</dt>
          <dd>{s.ratio_quarters} quarters of bank lending and the regulator's minimum</dd>
        </div>
        <div>
          <dt className="text-muted">New loans planned</dt>
          <dd>
            {s.new_loans.limits} limits, {formatNPR(s.new_loans.amount)}, scheduled over {s.new_loans.quarters} quarters
          </dd>
        </div>
        <div>
          <dt className="text-muted">Monthly generation</dt>
          <dd>
            {s.generation.borrowers} borrowers, {s.generation.plants} plants, {formatNumber(s.generation.months, 'en', 0)}{' '}
            plant-months
          </dd>
        </div>
        <div>
          <dt className="text-muted">Province and district</dt>
          <dd>
            Found in the DoED licence list for {s.located} of {s.borrowers}
          </dd>
        </div>
      </dl>

      {s.notes.length > 0 && (
        <details className="rounded-md border border-line p-3 text-sm">
          <summary className="cursor-pointer font-medium">Notes from reading the workbooks ({s.notes.length})</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {s.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </details>
      )}

      {upload.status === 'applied' && upload.result && (
        <p role="status" className="text-sm text-success">
          Loaded by {upload.applied_by} {upload.applied_at ? `on ${formatDate(upload.applied_at)}` : ''}:{' '}
          {upload.result.projects} projects, {upload.result.loans} loans, {upload.result.projection} projection quarters,{' '}
          {upload.result.generation} generation months.
        </p>
      )}
    </div>
  );
}

/**
 * Load the bank's portfolio from the workbooks the credit department already keeps. Reading them changes nothing;
 * loading is a change request that a second administrator approves. Shown only where the backend offers it.
 */
export function BankImportCard() {
  const imports = useBankImports();
  const preview = usePreviewBankImport();
  const propose = useProposeChange('BANK_IMPORT');
  const [projection, setProjection] = useState<File | null>(null);
  const [generation, setGeneration] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  if (!imports.data?.enabled) return null;
  const latest = preview.data ?? imports.data.imports[0];
  // The list has the latest request state; a just-read upload may not be in it yet
  const current = latest ? (imports.data.imports.find((row) => row.id === latest.id) ?? latest) : undefined;
  const canSubmit = current && current.status === 'previewed' && current.agrees && !current.request;
  const replaces = current?.replaces;

  return (
    <Card className="mt-6">
      <CardHeader
        title="Import bank workbooks"
        description="Load the portfolio from the bank's own workbooks: the loan projection workbook and the generation workbook. Reading them changes nothing; loading needs a second administrator's approval."
      />
      <CardBody>
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            if (projection && generation) preview.mutate({ projection, generation });
          }}
        >
          <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium">
            Loan projection workbook (.xlsx)
            <input
              type="file"
              accept=".xlsx"
              className="text-sm font-normal"
              onChange={(event) => setProjection(event.target.files?.[0] ?? null)}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium">
            Generation workbook (.xlsx)
            <input
              type="file"
              accept=".xlsx"
              className="text-sm font-normal"
              onChange={(event) => setGeneration(event.target.files?.[0] ?? null)}
            />
          </label>
          <Button type="submit" disabled={!projection || !generation || preview.isPending}>
            {preview.isPending ? 'Reading…' : 'Read and check'}
          </Button>
        </form>
        {preview.isError && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {getErrorMessage(preview.error)}
          </p>
        )}

        {current && (
          <div className="mt-6 border-t border-line pt-6">
            <Summary upload={current} />
            {canSubmit && (
              <div className="mt-4 rounded-md bg-surface-2 p-4 text-sm">
                {replaces && (
                  <p>
                    Loading replaces the current portfolio: {replaces.projects} projects, {replaces.loans} loans,{' '}
                    {replaces.documents} documents and {replaces.change_requests} project change requests. Users, settings,
                    approval rules and the audit log are kept.
                  </p>
                )}
                <Button className="mt-3" onClick={() => setSubmitting(true)}>
                  Submit for approval
                </Button>
              </div>
            )}
            {current.request && current.status === 'previewed' && current.request.state !== 'rejected' && (
              <p className="mt-4 text-sm">
                Another administrator approves it in <Link to="/approvals" className="font-medium underline">Approvals</Link>.
                The portfolio changes the moment it is approved.
              </p>
            )}
          </div>
        )}
      </CardBody>
      {submitting && current && (
        <JustificationModal
          isOpen
          onClose={() => {
            setSubmitting(false);
            setSubmitError('');
          }}
          entityType="Bank workbook import"
          entityId={current.id}
          actionName="loading these workbooks"
          isLoading={propose.isPending}
          allowDocument={false}
          onSubmit={async ({ reason }) => {
            try {
              await propose.mutateAsync({
                entityId: current.id,
                changes: { files: current.files, projection: current.projection_filename, generation: current.generation_filename },
                justification: reason,
              });
              setSubmitting(false);
              setSubmitError('');
              await imports.refetch();
            } catch (error) {
              setSubmitError(getErrorMessage(error));
            }
          }}
        >
          {submitError && (
            <p role="alert" className="text-sm text-danger">
              {submitError}
            </p>
          )}
        </JustificationModal>
      )}
    </Card>
  );
}
