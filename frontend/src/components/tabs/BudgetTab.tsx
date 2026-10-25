import { useState } from 'react';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card, CardBody, CardHeader } from '@/components/common/Card';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Input } from '@/components/common/Field';
import { EmptyState } from '@/components/common/States';
import { JustificationModal } from '@/components/modals/JustificationModal';
import { getErrorMessage } from '@/services/api';
import {
  type BudgetLine,
  formatNpr,
  isAmount,
  plansApi,
  type UploadPreview,
  useBudget,
  useProposeChange,
} from '@/services/changeRequests';
import { useAuthStore } from '@/store/useAuthStore';
import { Figure, TabState } from './TabState';

function VarianceBadge({ line, plain = false }: { line: Pick<BudgetLine, 'variance_amount' | 'variance_pct'>; plain?: boolean }) {
  const amount = Number(line.variance_amount ?? 0);
  if (!line.variance_amount || amount === 0) return <span className="text-muted">On budget</span>;
  const pct = line.variance_pct !== null ? ` (${Math.abs(Number(line.variance_pct)).toFixed(1)}%)` : '';
  // In the summary figures a badge does not wrap and is cut off on narrow screens
  if (plain) return <span className={amount > 0 ? 'text-danger' : 'text-muted'}>{amount > 0 ? 'Over by' : 'Under by'} {formatNpr(Math.abs(amount))}{pct}</span>;
  return amount > 0 ? (
    <Badge tone="danger">Over by {formatNpr(amount)}{pct}</Badge>
  ) : (
    <span className="text-sm text-muted">{formatNpr(-amount)} under{pct}</span>
  );
}

type Row = { key: string; id?: string; category: string; budgeted_amount: string; actual_amount: string; remove: boolean };

/** Edit the budget as a whole: change lines, add lines, mark lines for removal. One change request. */
function ChangeBudgetModal({ projectId, lines, onClose, onSubmitted }: {
  projectId: string; lines: BudgetLine[]; onClose: () => void; onSubmitted: (message: string) => void;
}) {
  const propose = useProposeChange('BUDGET_LINE');
  const [rows, setRows] = useState<Row[]>(() =>
    lines.map((l) => ({ key: l.id, id: l.id, category: l.category, budgeted_amount: String(Number(l.budgeted_amount)), actual_amount: String(Number(l.actual_amount)), remove: false })),
  );
  const [source, setSource] = useState('');
  const set = (key: string, patch: Partial<Row>) => setRows((current) => current.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const original = new Map(lines.map((l) => [l.id, l]));
  const changed = rows.filter((r) => {
    if (r.remove) return Boolean(r.id);
    const before = r.id ? original.get(r.id) : undefined;
    return !before || before.category !== r.category.trim() || Number(before.budgeted_amount) !== Number(r.budgeted_amount) || Number(before.actual_amount) !== Number(r.actual_amount);
  });
  const kept = rows.filter((r) => !r.remove);
  const invalid = kept.some((r) => !r.category.trim() || !isAmount(r.budgeted_amount) || (r.actual_amount !== '' && !isAmount(r.actual_amount)));
  const duplicate = new Set(kept.map((r) => r.category.trim().toLowerCase())).size !== kept.length;
  const problem = invalid ? 'Each line needs a category and amounts of zero or more, with at most two decimals'
    : duplicate ? 'A category appears twice' : null;
  return (
    <JustificationModal
      isOpen
      onClose={onClose}
      entityType="Budget"
      entityId={projectId}
      actionName="changing this project's budget"
      isLoading={propose.isPending}
      canSubmit={!problem && changed.length > 0 && source.trim().length >= 3}
      allowDocument={false}
      onSubmit={async ({ reason }) => {
        try {
          await propose.mutateAsync({
            entityId: projectId,
            justification: reason,
            changes: {
              source_reference: source.trim(),
              lines: changed.filter((r) => !r.remove).map((r) => ({
                ...(r.id ? { id: r.id } : {}), category: r.category.trim(), budgeted_amount: r.budgeted_amount.trim(), actual_amount: r.actual_amount.trim() || '0',
              })),
              remove: changed.filter((r) => r.remove).map((r) => r.id),
            },
          });
        } catch (error) {
          throw new Error(getErrorMessage(error), { cause: error });
        }
        onSubmitted(`Budget change sent for approval (${changed.length} ${changed.length === 1 ? 'line' : 'lines'}).`);
      }}
    >
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.key} className={`grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end ${r.remove ? 'opacity-50' : ''}`}>
            <Input label="Category" value={r.category} disabled={r.remove} onChange={(e) => set(r.key, { category: e.target.value })} />
            <Input label="Budget (NPR)" inputMode="decimal" value={r.budgeted_amount} disabled={r.remove} onChange={(e) => set(r.key, { budgeted_amount: e.target.value })} />
            <Input label="Actual (NPR)" inputMode="decimal" value={r.actual_amount} disabled={r.remove} onChange={(e) => set(r.key, { actual_amount: e.target.value })} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => (r.id ? set(r.key, { remove: !r.remove }) : setRows((current) => current.filter((x) => x.key !== r.key)))}
            >
              {r.remove ? 'Keep' : 'Remove'}
            </Button>
          </div>
        ))}
        <div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setRows((current) => [...current, { key: crypto.randomUUID(), category: '', budgeted_amount: '', actual_amount: '0', remove: false }])}
          >
            Add a line
          </Button>
        </div>
        <Input label="Source of the figures" placeholder="Board-approved budget, contractor bills to date" value={source} onChange={(e) => setSource(e.target.value)} />
        {problem && <p className="text-sm text-danger">{problem}</p>}
      </div>
    </JustificationModal>
  );
}

/** Read a sheet, show what it would change and which rows cannot be used, then raise one change request. */
function UploadBudgetModal({ projectId, onClose, onSubmitted }: { projectId: string; onClose: () => void; onSubmitted: (message: string) => void }) {
  const propose = useProposeChange('BUDGET_LINE');
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [readError, setReadError] = useState<unknown>(null);
  const [source, setSource] = useState('');
  return (
    <JustificationModal
      isOpen
      onClose={onClose}
      entityType="Budget"
      entityId={projectId}
      actionName="loading this project's budget from a file"
      isLoading={propose.isPending}
      canSubmit={Boolean(preview?.lines.length) && source.trim().length >= 3}
      allowDocument={false}
      onSubmit={async ({ reason }) => {
        try {
          await propose.mutateAsync({
            entityId: projectId,
            justification: reason,
            changes: {
              source_reference: source.trim(),
              upload_batch_id: preview!.upload_batch_id,
              lines: preview!.lines.map((l) => ({ ...(l.id ? { id: l.id } : {}), category: l.category, budgeted_amount: l.budgeted_amount, actual_amount: l.actual_amount })),
            },
          });
        } catch (error) {
          throw new Error(getErrorMessage(error), { cause: error });
        }
        onSubmitted(`${preview!.lines.length} budget lines from ${preview!.file_name} sent for approval.`);
      }}
    >
      <div className="flex flex-col gap-3">
        <div>
          <label htmlFor="budget-file" className="mb-1 block text-sm font-medium">Budget sheet (Excel or CSV)</label>
          <input
            id="budget-file"
            type="file"
            accept=".xlsx,.csv"
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-line file:bg-surface file:px-3 file:py-1.5"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setPreview(null);
              setReadError(null);
              if (file) plansApi.previewUpload(projectId, file).then(setPreview, setReadError);
            }}
          />
          <p className="mt-1 text-xs text-muted">First row: Category, Budgeted amount, Actual amount. A category already on the budget updates that line.</p>
        </div>
        {readError ? <p role="alert" className="text-sm text-danger">{getErrorMessage(readError)}</p> : null}
        {preview && (
          <>
            <p className="text-sm">
              {preview.lines.filter((l) => l.change === 'add').length} new, {preview.lines.filter((l) => l.change === 'update').length} updated
              {preview.errors.length > 0 && `, ${preview.errors.length} rows cannot be used`}
            </p>
            {preview.errors.length > 0 && (
              <ul className="list-disc pl-5 text-sm text-danger" aria-label="Rows that cannot be used">
                {preview.errors.map((e) => <li key={e.row}>Row {e.row}: {e.message}</li>)}
              </ul>
            )}
            <Input label="Source of the figures" value={source} onChange={(e) => setSource(e.target.value)} />
          </>
        )}
      </div>
    </JustificationModal>
  );
}

export function BudgetTab({ projectId }: { projectId: string }) {
  const query = useBudget(projectId);
  const roles = useAuthStore((s) => s.user?.roles) ?? [];
  const canPropose = roles.includes('admin') || roles.includes('maker');
  const [open, setOpen] = useState<'change' | 'upload' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const columns: Column<BudgetLine>[] = [
    { key: 'category', header: 'Cost head', render: (l) => l.category },
    { key: 'budget', header: 'Budget (NPR)', align: 'right', render: (l) => formatNpr(l.budgeted_amount) },
    { key: 'actual', header: 'Actual (NPR)', align: 'right', render: (l) => formatNpr(l.actual_amount) },
    { key: 'variance', header: 'Variance', align: 'right', render: (l) => <VarianceBadge line={l} /> },
  ];
  return (
    <TabState query={query}>
      {(budget) => (
        <Card>
          <CardHeader
            title="Budget and cost"
            description="Budget against actual cost by cost head. Changes go through maker-checker."
            actions={
              canPropose && (
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setOpen('upload')}>Upload budget</Button>
                  <Button variant="secondary" size="sm" onClick={() => setOpen('change')}>Change budget</Button>
                </div>
              )
            }
          />
          <CardBody>
            {notice && <p role="status" className="mb-4 rounded-md bg-success-soft p-3 text-sm text-success">{notice} Track it under Approvals.</p>}
            {budget.lines.length > 0 && (
              <dl className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Figure label="Budget" value={`NPR ${formatNpr(budget.totals.budgeted_amount)}`} />
                <Figure label="Actual" value={`NPR ${formatNpr(budget.totals.actual_amount)}`} />
                <Figure label="Variance" value={<VarianceBadge line={budget.totals} plain />} />
                <Figure label="Heads over budget" value={budget.totals.overspent_lines} />
              </dl>
            )}
            <DataTable caption="Budget and cost" columns={columns} rows={budget.lines} rowKey={(l) => l.id} empty={<EmptyState title="No budget recorded" />} />
          </CardBody>
          {open === 'change' && (
            <ChangeBudgetModal projectId={projectId} lines={budget.lines} onClose={() => setOpen(null)} onSubmitted={(m) => { setNotice(m); setOpen(null); }} />
          )}
          {open === 'upload' && (
            <UploadBudgetModal projectId={projectId} onClose={() => setOpen(null)} onSubmitted={(m) => { setNotice(m); setOpen(null); }} />
          )}
        </Card>
      )}
    </TabState>
  );
}
