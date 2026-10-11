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
  type CommunityRecord,
  type EsiaRecord,
  type InsurancePolicy,
  POLICY_TYPES,
  recordsApi,
  useProjectRecords,
  useRecordMutation,
} from '@/services/projectRecords';
import { formatDate, humanize } from '@/utils/format';
import { TabState } from './TabState';

const DAY_MS = 86_400_000;
const EXPIRY_WARNING_DAYS = 90;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Days until a date (negative once past). */
function daysUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - new Date(today()).getTime()) / DAY_MS);
}

function FormError({ error }: { error: unknown }) {
  return error ? <p className="mt-3 text-sm text-danger">{getErrorMessage(error)}</p> : null;
}

// ---------------------------------------------------------------- insurance (E.11)

function policyTone(policy: InsurancePolicy): BadgeTone {
  if (policy.status !== 'active') return 'neutral';
  const days = daysUntil(policy.valid_to_ad);
  if (days < 0) return 'danger';
  return days <= EXPIRY_WARNING_DAYS ? 'warning' : 'success';
}

function AddPolicyModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [form, setForm] = useState({
    policy_number: '', insurer: '', policy_type: POLICY_TYPES[0] as string,
    sum_insured_npr: '', premium_npr: '', valid_from_ad: today(), valid_to_ad: '',
  });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const save = useRecordMutation(projectId, 'insurance', () =>
    recordsApi.create(projectId, 'insurance', {
      policy_number: form.policy_number.trim(),
      insurer: form.insurer.trim(),
      policy_type: form.policy_type,
      sum_insured_npr: form.sum_insured_npr || null,
      premium_npr: form.premium_npr || null,
      valid_from_ad: form.valid_from_ad,
      valid_to_ad: form.valid_to_ad,
    }),
  );
  const valid = form.policy_number.trim() && form.insurer.trim() && form.valid_to_ad && form.valid_to_ad >= form.valid_from_ad;
  return (
    <BaseModal
      isOpen
      onClose={onClose}
      title="Add an insurance policy"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid} loading={save.isPending} onClick={() => save.mutate(undefined, { onSuccess: onClose })}>Add policy</Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Policy number" value={form.policy_number} onChange={(e) => set('policy_number', e.target.value)} />
        <Input label="Insurer" value={form.insurer} onChange={(e) => set('insurer', e.target.value)} />
        <Select label="Type" value={form.policy_type} onChange={(e) => set('policy_type', e.target.value)} options={POLICY_TYPES.map((t) => ({ value: t, label: humanize(t) }))} />
        <Input label="Sum insured (NPR)" type="number" min={0} value={form.sum_insured_npr} onChange={(e) => set('sum_insured_npr', e.target.value)} />
        <Input label="Premium (NPR)" type="number" min={0} value={form.premium_npr} onChange={(e) => set('premium_npr', e.target.value)} />
        <Input label="Valid from" type="date" value={form.valid_from_ad} onChange={(e) => set('valid_from_ad', e.target.value)} />
        <Input label="Valid to" type="date" value={form.valid_to_ad} min={form.valid_from_ad} onChange={(e) => set('valid_to_ad', e.target.value)} />
      </div>
      <FormError error={save.error} />
    </BaseModal>
  );
}

export function InsuranceTab({ projectId }: { projectId: string }) {
  const query = useProjectRecords<InsurancePolicy>(projectId, 'insurance');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<InsurancePolicy | null>(null);
  const [status, setStatus] = useState<InsurancePolicy['status']>('active');
  const setPolicyStatus = useRecordMutation(projectId, 'insurance', () =>
    recordsApi.update<InsurancePolicy, { status: string }>(projectId, 'insurance', editing!.id, { status }),
  );
  const columns: Column<InsurancePolicy>[] = [
    { key: 'policy', header: 'Policy', render: (p) => <span>{p.policy_number}<span className="block text-xs text-muted">{p.insurer}</span></span> },
    { key: 'type', header: 'Type', hideOnMobile: true, render: (p) => humanize(p.policy_type) },
    { key: 'sum', header: 'Sum insured', align: 'right', hideOnMobile: true, render: (p) => (p.sum_insured_npr ? Number(p.sum_insured_npr).toLocaleString('en-IN') : '—') },
    {
      key: 'valid_to',
      header: 'Valid to',
      render: (p) => (
        <span className="flex items-center gap-2">
          {formatDate(p.valid_to_ad)}
          {p.status === 'active' && <Badge tone={policyTone(p)}>{daysUntil(p.valid_to_ad) < 0 ? 'Expired' : `${daysUntil(p.valid_to_ad)} days`}</Badge>}
        </span>
      ),
    },
    { key: 'status', header: 'Status', hideOnMobile: true, render: (p) => humanize(p.status) },
    { key: 'actions', header: '', align: 'right', render: (p) => <Button variant="ghost" size="sm" onClick={() => { setStatus(p.status); setEditing(p); }}>Set status</Button> },
  ];
  return (
    <TabState query={query}>
      {(policies) => (
        <Card>
          <CardHeader
            title="Insurance policies"
            description={`Policies expiring within ${EXPIRY_WARNING_DAYS} days are flagged`}
            actions={<Button variant="secondary" size="sm" onClick={() => setAdding(true)}>Add policy</Button>}
          />
          <CardBody>
            <DataTable caption="Insurance policies" columns={columns} rows={policies} rowKey={(p) => p.id} empty={<EmptyState title="No insurance policies recorded" />} />
          </CardBody>
          {adding && <AddPolicyModal projectId={projectId} onClose={() => setAdding(false)} />}
          {editing && (
            <BaseModal
              isOpen
              onClose={() => setEditing(null)}
              title={`Status of ${editing.policy_number}`}
              footer={
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
                  <Button loading={setPolicyStatus.isPending} onClick={() => setPolicyStatus.mutate(undefined, { onSuccess: () => setEditing(null) })}>Save status</Button>
                </div>
              }
            >
              <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as InsurancePolicy['status'])} options={['active', 'renewed', 'expired', 'cancelled'].map((s) => ({ value: s, label: humanize(s) }))} />
              <FormError error={setPolicyStatus.error} />
            </BaseModal>
          )}
        </Card>
      )}
    </TabState>
  );
}

// ---------------------------------------------------------------- ESIA monitoring (E.17)

const COMPLIANCE_TONE: Record<EsiaRecord['compliance_status'], BadgeTone> = {
  compliant: 'success', observation: 'warning', non_compliant: 'danger',
};

function AddEsiaModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [form, setForm] = useState({ monitoring_date_ad: today(), parameter: '', finding: '', compliance_status: 'compliant', corrective_action: '' });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const save = useRecordMutation(projectId, 'esia-monitoring', () =>
    recordsApi.create(projectId, 'esia-monitoring', {
      monitoring_date_ad: form.monitoring_date_ad,
      parameter: form.parameter.trim(),
      finding: form.finding.trim() || null,
      compliance_status: form.compliance_status,
      corrective_action: form.corrective_action.trim() || null,
    }),
  );
  return (
    <BaseModal
      isOpen
      onClose={onClose}
      title="Record an ESIA monitoring result"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!form.parameter.trim()} loading={save.isPending} onClick={() => save.mutate(undefined, { onSuccess: onClose })}>Record</Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Monitoring date" type="date" max={today()} value={form.monitoring_date_ad} onChange={(e) => set('monitoring_date_ad', e.target.value)} />
        <Input label="Parameter" placeholder="Water quality, noise, biodiversity, resettlement" value={form.parameter} onChange={(e) => set('parameter', e.target.value)} />
        <Select label="Compliance" className="sm:col-span-2" value={form.compliance_status} onChange={(e) => set('compliance_status', e.target.value)} options={['compliant', 'observation', 'non_compliant'].map((s) => ({ value: s, label: humanize(s) }))} />
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">Finding<textarea className="rounded-md border border-border p-2" rows={3} value={form.finding} onChange={(e) => set('finding', e.target.value)} /></label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">Corrective action<textarea className="rounded-md border border-border p-2" rows={2} value={form.corrective_action} onChange={(e) => set('corrective_action', e.target.value)} /></label>
      </div>
      <FormError error={save.error} />
    </BaseModal>
  );
}

export function EsiaTab({ projectId }: { projectId: string }) {
  const query = useProjectRecords<EsiaRecord>(projectId, 'esia-monitoring');
  const [adding, setAdding] = useState(false);
  const columns: Column<EsiaRecord>[] = [
    { key: 'date', header: 'Date', render: (r) => formatDate(r.monitoring_date_ad) },
    { key: 'parameter', header: 'Parameter', render: (r) => r.parameter },
    { key: 'finding', header: 'Finding', hideOnMobile: true, render: (r) => r.finding ?? '—' },
    { key: 'status', header: 'Compliance', render: (r) => <Badge tone={COMPLIANCE_TONE[r.compliance_status]}>{humanize(r.compliance_status)}</Badge> },
    { key: 'action', header: 'Corrective action', hideOnMobile: true, render: (r) => r.corrective_action ?? '—' },
  ];
  return (
    <TabState query={query}>
      {(records) => (
        <Card>
          <CardHeader title="ESIA monitoring" description="Environmental and social monitoring results" actions={<Button variant="secondary" size="sm" onClick={() => setAdding(true)}>Record result</Button>} />
          <CardBody>
            <DataTable caption="ESIA monitoring" columns={columns} rows={records} rowKey={(r) => r.id} empty={<EmptyState title="No monitoring results recorded" />} />
          </CardBody>
          {adding && <AddEsiaModal projectId={projectId} onClose={() => setAdding(false)} />}
        </Card>
      )}
    </TabState>
  );
}

// ---------------------------------------------------------------- community engagement and grievances (E.18)

const ENGAGEMENT_TONE: Record<CommunityRecord['status'], BadgeTone> = {
  open: 'warning', in_progress: 'info', resolved: 'success', closed: 'neutral',
};

function AddCommunityModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [form, setForm] = useState({ engagement_type: 'grievance', engagement_date_ad: today(), stakeholder_group: '', summary: '' });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const save = useRecordMutation(projectId, 'community-engagements', () =>
    recordsApi.create(projectId, 'community-engagements', {
      engagement_type: form.engagement_type,
      engagement_date_ad: form.engagement_date_ad,
      stakeholder_group: form.stakeholder_group.trim() || null,
      summary: form.summary.trim(),
    }),
  );
  return (
    <BaseModal
      isOpen
      onClose={onClose}
      title="Record a consultation or grievance"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!form.summary.trim()} loading={save.isPending} onClick={() => save.mutate(undefined, { onSuccess: onClose })}>Record</Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select label="Type" value={form.engagement_type} onChange={(e) => set('engagement_type', e.target.value)} options={[{ value: 'grievance', label: 'Grievance' }, { value: 'consultation', label: 'Consultation' }]} />
        <Input label="Date" type="date" max={today()} value={form.engagement_date_ad} onChange={(e) => set('engagement_date_ad', e.target.value)} />
        <Input label="Stakeholder group (optional)" className="sm:col-span-2" value={form.stakeholder_group} onChange={(e) => set('stakeholder_group', e.target.value)} />
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">Summary<textarea className="rounded-md border border-border p-2" rows={3} value={form.summary} onChange={(e) => set('summary', e.target.value)} /></label>
      </div>
      <FormError error={save.error} />
    </BaseModal>
  );
}

export function CommunityTab({ projectId }: { projectId: string }) {
  const query = useProjectRecords<CommunityRecord>(projectId, 'community-engagements');
  const [adding, setAdding] = useState(false);
  const [resolving, setResolving] = useState<CommunityRecord | null>(null);
  const [resolution, setResolution] = useState('');
  const resolve = useRecordMutation(projectId, 'community-engagements', () =>
    recordsApi.update<CommunityRecord, { status: string; resolution: string; resolved_date_ad: string }>(
      projectId, 'community-engagements', resolving!.id,
      { status: 'resolved', resolution: resolution.trim(), resolved_date_ad: today() },
    ),
  );
  const columns: Column<CommunityRecord>[] = [
    { key: 'type', header: 'Type', render: (r) => humanize(r.engagement_type) },
    { key: 'date', header: 'Date', hideOnMobile: true, render: (r) => formatDate(r.engagement_date_ad) },
    { key: 'summary', header: 'Summary', render: (r) => <span>{r.summary}<span className="block text-xs text-muted">{r.stakeholder_group ?? ''}</span></span> },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={ENGAGEMENT_TONE[r.status]}>{humanize(r.status)}</Badge> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) =>
        r.engagement_type === 'grievance' && (r.status === 'open' || r.status === 'in_progress') ? (
          <Button variant="ghost" size="sm" onClick={() => { setResolution(''); setResolving(r); }}>Mark resolved</Button>
        ) : (
          r.resolution && <span className="text-xs text-muted">{r.resolution}</span>
        ),
    },
  ];
  return (
    <TabState query={query}>
      {(records) => (
        <Card>
          <CardHeader title="Community engagement and grievances" description="Consultations and grievances, with how each was resolved" actions={<Button variant="secondary" size="sm" onClick={() => setAdding(true)}>Record</Button>} />
          <CardBody>
            <DataTable caption="Community engagement" columns={columns} rows={records} rowKey={(r) => r.id} empty={<EmptyState title="No consultations or grievances recorded" />} />
          </CardBody>
          {adding && <AddCommunityModal projectId={projectId} onClose={() => setAdding(false)} />}
          {resolving && (
            <BaseModal
              isOpen
              onClose={() => setResolving(null)}
              title="Mark this grievance resolved"
              footer={
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setResolving(null)}>Cancel</Button>
                  <Button disabled={resolution.trim().length < 5} loading={resolve.isPending} onClick={() => resolve.mutate(undefined, { onSuccess: () => setResolving(null) })}>Mark resolved</Button>
                </div>
              }
            >
              <label className="flex flex-col gap-1 text-sm">How it was resolved<textarea className="rounded-md border border-border p-2" rows={3} value={resolution} onChange={(e) => setResolution(e.target.value)} /></label>
              <FormError error={resolve.error} />
            </BaseModal>
          )}
        </Card>
      )}
    </TabState>
  );
}
