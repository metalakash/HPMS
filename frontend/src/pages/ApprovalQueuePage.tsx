import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { AlertTriangle } from 'lucide-react';
import { Badge, type BadgeTone } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Select } from '@/components/common/Field';
import { EmptyState, ErrorState } from '@/components/common/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { BaseModal } from '@/components/modals/BaseModal';
import { useApprovalQueue, useDecideApproval } from '@/hooks/queries';
import { getErrorMessage } from '@/services/api';
import type { ApprovalItem, ApprovalStateName } from '@/types/api';
import { formatDate, humanize } from '@/utils/format';

const MIN_REJECTION_REMARKS = 10;

const STATES: { value: ApprovalStateName; label: string; tone: BadgeTone }[] = [
  { value: 'submitted', label: 'Awaiting first check', tone: 'warning' },
  { value: 'recommended', label: 'Awaiting final approval', tone: 'info' },
  { value: 'approved', label: 'Approved', tone: 'success' },
  { value: 'rejected', label: 'Rejected', tone: 'danger' },
];

function StateBadge({ state }: { state: string }) {
  const known = STATES.find((s) => s.value === state);
  return <Badge tone={known?.tone ?? 'neutral'}>{known?.label ?? humanize(state)}</Badge>;
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function summary(item: ApprovalItem): string {
  const fields = Object.keys(item.changes ?? {});
  return fields.length ? fields.map(humanize).join(', ') : '—';
}

/** Change requests the signed-in user may see: checkers see all, makers their own. */
export default function ApprovalQueuePage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const query = useApprovalQueue({ status });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const approvals = query.data?.approvals ?? [];
  const selected = approvals.find((a) => a.id === selectedId) ?? null;

  const columns: Column<ApprovalItem>[] = [
    {
      key: 'request',
      header: 'Request',
      render: (a) => (
        <div>
          <p className="font-medium">{a.entity_label ?? a.entity_id}</p>
          <p className="text-xs text-muted">{humanize(a.entity_type)}</p>
        </div>
      ),
    },
    { key: 'changes', header: 'Fields changed', hideOnMobile: true, render: summary },
    {
      key: 'maker',
      header: 'Submitted by',
      hideOnMobile: true,
      render: (a) => a.maker_name ?? a.maker_id,
    },
    {
      key: 'submitted',
      header: 'Submitted',
      hideOnMobile: true,
      render: (a) => formatDate(a.submitted_at),
    },
    { key: 'state', header: 'Status', render: (a) => <StateBadge state={a.current_state} /> },
    {
      key: 'action',
      header: 'Action',
      render: (a) => (
        <Button variant="secondary" size="sm" onClick={() => setSelectedId(a.id)}>
          {a.can_decide ? 'Review' : 'View'}
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Change requests under maker-checker control. A change takes effect after two different checkers approve it."
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select
          label="Status"
          value={status}
          onChange={(e) => setParams(e.target.value ? { status: e.target.value } : {})}
          placeholder="All requests"
          options={STATES.map((s) => ({ value: s.value, label: s.label }))}
        />
      </div>

      <Card>
        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <DataTable
            caption="Change requests"
            columns={columns}
            rows={approvals}
            rowKey={(a) => a.id}
            loading={query.isLoading}
            empty={
              <EmptyState
                title={status ? 'No requests in this state' : 'No change requests'}
                description={
                  status
                    ? undefined
                    : 'Requests appear here when a maker proposes a change to a project or loan.'
                }
              />
            }
          />
        )}
      </Card>

      {selected && (
        <ReviewModal key={selected.id} item={selected} onClose={() => setSelectedId(null)} />
      )}
    </>
  );
}

function ReviewModal({ item, onClose }: { item: ApprovalItem; onClose: () => void }) {
  const decide = useDecideApproval();
  const [remarks, setRemarks] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const finalStep = item.current_state === 'recommended';
  const fields = Object.keys(item.changes ?? {});
  const remarksOk = remarks.trim().length >= MIN_REJECTION_REMARKS;

  const act = (verb: 'approve' | 'reject') =>
    decide.mutate({ id: item.id, verb, remarks: remarks.trim() }, { onSuccess: onClose });

  const footer = item.can_decide ? (
    <div className="flex flex-wrap justify-end gap-2">
      {rejecting ? (
        <>
          <Button variant="ghost" onClick={() => setRejecting(false)} disabled={decide.isPending}>
            Back
          </Button>
          <Button
            variant="danger"
            onClick={() => act('reject')}
            disabled={!remarksOk}
            loading={decide.isPending}
          >
            Confirm rejection
          </Button>
        </>
      ) : (
        <>
          <Button
            variant="secondary"
            onClick={() => setRejecting(true)}
            disabled={decide.isPending}
          >
            Reject
          </Button>
          <Button onClick={() => act('approve')} loading={decide.isPending}>
            {finalStep ? 'Approve and apply' : 'Recommend'}
          </Button>
        </>
      )}
    </div>
  ) : undefined;

  return (
    <BaseModal
      isOpen
      onClose={onClose}
      size="lg"
      title={item.entity_label ?? `${humanize(item.entity_type)} ${item.entity_id}`}
      description={`${humanize(item.entity_type)} change request`}
      footer={footer}
    >
      <div className="flex flex-col gap-4 text-sm">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <dt className="text-muted">Status</dt>
            <dd className="mt-1">
              <StateBadge state={item.current_state} />
            </dd>
          </div>
          <div>
            <dt className="text-muted">Submitted by</dt>
            <dd className="mt-1 font-medium">{item.maker_name ?? item.maker_id}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted">Justification</dt>
            <dd className="mt-1">{item.justification ?? '—'}</dd>
          </div>
        </dl>

        <table className="w-full border-collapse">
          <caption className="sr-only">Proposed changes</caption>
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th scope="col" className="py-2 pr-3 font-medium">
                Field
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Value when submitted
              </th>
              <th scope="col" className="py-2 font-medium">
                Proposed
              </th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr key={field} className="border-b border-line last:border-0">
                <th scope="row" className="py-2 pr-3 text-left font-medium">
                  {humanize(field)}
                </th>
                <td className="py-2 pr-3 text-muted">{display(item.previous_values?.[field])}</td>
                <td className="py-2 font-medium">{display(item.changes?.[field])}</td>
              </tr>
            ))}
            {fields.length === 0 && (
              <tr>
                <td colSpan={3} className="py-2 text-muted">
                  The details of this request are not available.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {item.can_decide && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="decision-remarks" className="font-medium">
              Remarks{rejecting ? ' (required to reject)' : ' (optional)'}
            </label>
            <textarea
              id="decision-remarks"
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg"
              aria-invalid={rejecting && !remarksOk ? true : undefined}
            />
            {rejecting && !remarksOk && (
              <p className="text-muted">
                Give a reason of at least {MIN_REJECTION_REMARKS} characters.
              </p>
            )}
          </div>
        )}

        {item.can_decide && !finalStep && !rejecting && (
          <p className="text-muted">
            Recommending passes this to a second checker for final approval. Nothing changes yet.
          </p>
        )}

        {decide.isError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md bg-danger-soft p-3 text-danger"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {getErrorMessage(decide.error)}
          </div>
        )}
      </div>
    </BaseModal>
  );
}
