import { useState } from 'react';
import { Badge, type BadgeTone } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card, CardBody, CardHeader } from '@/components/common/Card';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Input, Select } from '@/components/common/Field';
import { EmptyState } from '@/components/common/States';
import { BaseModal } from '@/components/modals/BaseModal';
import { getErrorMessage } from '@/services/api';
import {
  type MilestoneRecord,
  RISK_TYPES,
  type RiskRecord,
  recordsApi,
  useProjectRecords,
  useRecordMutation,
} from '@/services/projectRecords';
import { formatDate, humanize } from '@/utils/format';
import { TabState } from './TabState';

const SEVERITY_TONE: Record<RiskRecord['severity'], BadgeTone> = {
  low: 'success', medium: 'info', high: 'warning', critical: 'danger',
};
const MILESTONE_TONE: Record<MilestoneRecord['status'], BadgeTone> = {
  planned: 'neutral', in_progress: 'info', completed: 'success', delayed: 'danger',
};
const MITIGATION = ['open', 'in_progress', 'mitigated', 'accepted'] as const;
const MILESTONE_STATUS = ['planned', 'in_progress', 'completed', 'delayed'] as const;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function FormError({ error }: { error: unknown }) {
  return error ? <p className="mt-3 text-sm text-danger">{getErrorMessage(error)}</p> : null;
}

// ---------------------------------------------------------------- risk register (E.9, E.19, E.20)

function AddRiskModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [form, setForm] = useState({
    title: '', description: '', risk_type: RISK_TYPES[0] as string, likelihood: '3', impact: '3',
    mitigation_action: '', mitigation_owner: '', mitigation_due_ad: '', mitigation_status: 'open',
  });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const save = useRecordMutation(projectId, 'risks', () =>
    recordsApi.create(projectId, 'risks', {
      title: form.title.trim(),
      description: form.description.trim() || null,
      risk_type: form.risk_type,
      likelihood: Number(form.likelihood),
      impact: Number(form.impact),
      mitigation_action: form.mitigation_action.trim() || null,
      mitigation_owner: form.mitigation_owner.trim() || null,
      mitigation_due_ad: form.mitigation_due_ad || null,
      mitigation_status: form.mitigation_status,
    }),
  );
  const score = Number(form.likelihood) * Number(form.impact);
  return (
    <BaseModal
      isOpen
      onClose={onClose}
      title="Add a risk"
      description={`Likelihood and impact are each 1 to 5. Score ${score}: severity is worked out from it when saved.`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!form.title.trim()} loading={save.isPending} onClick={() => save.mutate(undefined, { onSuccess: onClose })}>Add risk</Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Risk" className="sm:col-span-2" value={form.title} onChange={(e) => set('title', e.target.value)} />
        <Select label="Type" value={form.risk_type} onChange={(e) => set('risk_type', e.target.value)} options={RISK_TYPES.map((t) => ({ value: t, label: humanize(t) }))} />
        <Select label="Mitigation status" value={form.mitigation_status} onChange={(e) => set('mitigation_status', e.target.value)} options={MITIGATION.map((s) => ({ value: s, label: humanize(s) }))} />
        <Input label="Likelihood (1-5)" type="number" min={1} max={5} value={form.likelihood} onChange={(e) => set('likelihood', e.target.value)} />
        <Input label="Impact (1-5)" type="number" min={1} max={5} value={form.impact} onChange={(e) => set('impact', e.target.value)} />
        <Input label="Mitigation action" className="sm:col-span-2" value={form.mitigation_action} onChange={(e) => set('mitigation_action', e.target.value)} />
        <Input label="Owner" value={form.mitigation_owner} onChange={(e) => set('mitigation_owner', e.target.value)} />
        <Input label="Mitigation due" type="date" min={today()} value={form.mitigation_due_ad} onChange={(e) => set('mitigation_due_ad', e.target.value)} />
      </div>
      <FormError error={save.error} />
    </BaseModal>
  );
}

export function RisksTab({ projectId }: { projectId: string }) {
  const query = useProjectRecords<RiskRecord>(projectId, 'risks');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<RiskRecord | null>(null);
  const [mitigation, setMitigation] = useState<RiskRecord['mitigation_status']>('open');
  const setStatus = useRecordMutation(projectId, 'risks', () =>
    recordsApi.update<RiskRecord, { mitigation_status: string }>(projectId, 'risks', editing!.id, { mitigation_status: mitigation }),
  );
  const scan = useRecordMutation(projectId, 'risks', () =>
    recordsApi.scanRisks(projectId),
  );

  const columns: Column<RiskRecord>[] = [
    { key: 'risk', header: 'Risk', render: (r) => <span>{r.title}<span className="block text-xs text-muted">{humanize(r.risk_type)}{r.trigger_source ? ` · raised by ${humanize(r.trigger_source)}` : ''}</span></span> },
    { key: 'score', header: 'L × I', align: 'right', hideOnMobile: true, render: (r) => `${r.likelihood} × ${r.impact}` },
    { key: 'severity', header: 'Severity', render: (r) => <Badge tone={SEVERITY_TONE[r.severity]}>{humanize(r.severity)}</Badge> },
    { key: 'owner', header: 'Owner', hideOnMobile: true, render: (r) => r.mitigation_owner ?? '—' },
    { key: 'due', header: 'Mitigation due', hideOnMobile: true, render: (r) => formatDate(r.mitigation_due_ad) },
    { key: 'status', header: 'Mitigation', render: (r) => humanize(r.mitigation_status) },
    { key: 'actions', header: '', align: 'right', render: (r) => <Button variant="ghost" size="sm" onClick={() => { setMitigation(r.mitigation_status); setEditing(r); }}>Update</Button> },
  ];

  return (
    <TabState query={query}>
      {(risks) => (
        <Card>
          <CardHeader
            title="Risk register"
            description="Project risks, how severe they are and how they are being mitigated"
            actions={
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" loading={scan.isPending} onClick={() => scan.mutate(undefined)}>Scan for risks</Button>
                <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>Add risk</Button>
              </div>
            }
          />
          <CardBody>
            {scan.isSuccess && <p className="mb-3 text-sm text-muted">Scan finished: {scan.data?.risks_created ?? 0} new risk(s) raised from milestone delays and covenant breaches.</p>}
            <FormError error={scan.error} />
            <DataTable caption="Risk register" columns={columns} rows={risks} rowKey={(r) => r.id} empty={<EmptyState title="No risks recorded" />} />
          </CardBody>
          {adding && <AddRiskModal projectId={projectId} onClose={() => setAdding(false)} />}
          {editing && (
            <BaseModal
              isOpen
              onClose={() => setEditing(null)}
              title={`Mitigation of "${editing.title}"`}
              footer={
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
                  <Button loading={setStatus.isPending} onClick={() => setStatus.mutate(undefined, { onSuccess: () => setEditing(null) })}>Save</Button>
                </div>
              }
            >
              <Select label="Mitigation status" value={mitigation} onChange={(e) => setMitigation(e.target.value as RiskRecord['mitigation_status'])} options={MITIGATION.map((s) => ({ value: s, label: humanize(s) }))} />
              <FormError error={setStatus.error} />
            </BaseModal>
          )}
        </Card>
      )}
    </TabState>
  );
}

// ---------------------------------------------------------------- milestones (C.5)

function AddMilestoneModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', category: '', planned_date_ad: '', status: 'planned', percent_complete: '0' });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const save = useRecordMutation(projectId, 'milestones', () =>
    recordsApi.create(projectId, 'milestones', {
      name: form.name.trim(),
      category: form.category.trim() || null,
      planned_date_ad: form.planned_date_ad,
      status: form.status,
      percent_complete: Number(form.percent_complete),
    }),
  );
  return (
    <BaseModal
      isOpen
      onClose={onClose}
      title="Add a milestone"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!form.name.trim() || !form.planned_date_ad} loading={save.isPending} onClick={() => save.mutate(undefined, { onSuccess: onClose })}>Add milestone</Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Milestone" className="sm:col-span-2" value={form.name} onChange={(e) => set('name', e.target.value)} />
        <Input label="Category (optional)" value={form.category} onChange={(e) => set('category', e.target.value)} />
        <Input label="Planned date" type="date" value={form.planned_date_ad} onChange={(e) => set('planned_date_ad', e.target.value)} />
        <Select label="Status" value={form.status} onChange={(e) => set('status', e.target.value)} options={MILESTONE_STATUS.map((s) => ({ value: s, label: humanize(s) }))} />
        <Input label="Percent complete" type="number" min={0} max={100} value={form.percent_complete} onChange={(e) => set('percent_complete', e.target.value)} />
      </div>
      <FormError error={save.error} />
    </BaseModal>
  );
}

export function MilestonesTab({ projectId }: { projectId: string }) {
  const query = useProjectRecords<MilestoneRecord>(projectId, 'milestones');
  const [adding, setAdding] = useState(false);
  const columns: Column<MilestoneRecord>[] = [
    { key: 'name', header: 'Milestone', render: (m) => <span>{m.name}<span className="block text-xs text-muted">{m.category ? humanize(m.category) : ''}</span></span> },
    { key: 'planned', header: 'Planned', render: (m) => formatDate(m.planned_date_ad) },
    { key: 'forecast', header: 'Forecast', hideOnMobile: true, render: (m) => formatDate(m.forecast_date_ad) },
    { key: 'status', header: 'Status', render: (m) => <Badge tone={MILESTONE_TONE[m.status]}>{humanize(m.status)}</Badge> },
    { key: 'pct', header: 'Complete', align: 'right', render: (m) => `${Number(m.percent_complete).toFixed(0)}%` },
  ];
  return (
    <TabState query={query}>
      {(milestones) => (
        <Card>
          <CardHeader title="Milestones" description="Planned and forecast dates; delays feed the risk register" actions={<Button variant="secondary" size="sm" onClick={() => setAdding(true)}>Add milestone</Button>} />
          <CardBody>
            <DataTable caption="Milestones" columns={columns} rows={milestones} rowKey={(m) => m.id} empty={<EmptyState title="No milestones recorded" />} />
          </CardBody>
          {adding && <AddMilestoneModal projectId={projectId} onClose={() => setAdding(false)} />}
        </Card>
      )}
    </TabState>
  );
}
