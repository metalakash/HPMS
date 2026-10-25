import { useState } from 'react';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card, CardBody, CardHeader } from '@/components/common/Card';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Input, Select } from '@/components/common/Field';
import { EmptyState, ErrorState } from '@/components/common/States';
import { BaseModal } from '@/components/modals/BaseModal';
import { ConfirmationModal } from '@/components/modals/ConfirmationModal';
import { getErrorMessage } from '@/services/api';
import { useRegulatoryMutation } from '@/services/reporting';
import {
  ALERT_TYPES,
  INTERACTION_KINDS,
  interactionsApi,
  type StakeholderContact,
  type StakeholderInput,
  stakeholdersApi,
  useInteractions,
  useStakeholders,
} from '@/services/stakeholders';
import { useAuthStore } from '@/store/useAuthStore';
import { formatDate, humanize } from '@/utils/format';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function ContactModal({ contact, onClose }: { contact?: StakeholderContact; onClose: () => void }) {
  const [form, setForm] = useState<StakeholderInput>({
    name: contact?.name ?? '',
    organization: contact?.organization ?? null,
    role: contact?.role ?? null,
    category: contact?.category ?? 'external',
    email: contact?.email ?? '',
    phone: contact?.phone ?? null,
    alert_types: contact?.alert_types ?? [...ALERT_TYPES],
    min_urgency: contact?.min_urgency ?? 'critical',
    is_active: contact?.is_active ?? true,
  });
  const set = <K extends keyof StakeholderInput>(key: K, value: StakeholderInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const toggleType = (type: string) => {
    const current = form.alert_types ?? [];
    set('alert_types', current.includes(type) ? current.filter((t) => t !== type) : [...current, type]);
  };
  const emailOk = EMAIL.test(form.email.trim());
  const valid = form.name.trim() && emailOk && (form.alert_types ?? []).length > 0;

  const save = useRegulatoryMutation(() => {
    const body = {
      ...form,
      name: form.name.trim(),
      email: form.email.trim(),
      organization: form.organization?.trim() || null,
      role: form.role?.trim() || null,
      phone: form.phone?.trim() || null,
    };
    if (!contact) return stakeholdersApi.create(body);
    // The contact PATCH endpoint does not take a category; it is fixed when the contact is created
    const changes: Partial<StakeholderInput> = { ...body };
    delete changes.category;
    return stakeholdersApi.update(contact.id, changes);
  });

  return (
    <BaseModal
      isOpen
      onClose={onClose}
      title={contact ? 'Edit contact' : 'Add a stakeholder contact'}
      description="Alerts of the selected types reach this contact at or above the chosen urgency."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid} loading={save.isPending} onClick={() => save.mutate(undefined, { onSuccess: onClose })}>
            {contact ? 'Save changes' : 'Add contact'}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Name" value={form.name} onChange={(e) => set('name', e.target.value)} />
        <Input label="Email" type="email" value={form.email} error={form.email && !emailOk ? 'Not an email address' : undefined} onChange={(e) => set('email', e.target.value)} />
        <Input label="Organisation" value={form.organization ?? ''} onChange={(e) => set('organization', e.target.value || null)} />
        <Input label="Role" value={form.role ?? ''} onChange={(e) => set('role', e.target.value || null)} />
        <Input label="Phone (optional)" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value || null)} />
        {!contact && (
          <Select
            label="Category"
            value={form.category}
            onChange={(e) => set('category', e.target.value as StakeholderInput['category'])}
            options={[{ value: 'external', label: 'External' }, { value: 'internal', label: 'Internal' }]}
          />
        )}
        <Select
          label="Lowest urgency to send"
          value={form.min_urgency}
          onChange={(e) => set('min_urgency', e.target.value as StakeholderInput['min_urgency'])}
          options={[{ value: 'critical', label: 'Critical only' }, { value: 'warning', label: 'Warnings and critical' }]}
        />
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium">Alert types</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {ALERT_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={(form.alert_types ?? []).includes(type)} onChange={() => toggleType(type)} />
                {humanize(type)}
              </label>
            ))}
          </div>
        </fieldset>
        {contact && (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
            Active (receives alerts)
          </label>
        )}
      </div>
      {save.isError && <p className="mt-3 text-sm text-danger">{getErrorMessage(save.error)}</p>}
    </BaseModal>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

/** A contact's performance history: dated interactions, rated 1 to 5. Admins and makers add to it. */
function HistoryModal({ contact, canRecord, onClose }: { contact: StakeholderContact; canRecord: boolean; onClose: () => void }) {
  const history = useInteractions(contact.id);
  const [form, setForm] = useState({ interaction_date_ad: today(), kind: 'meeting', rating: '', summary: '' });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const record = useRegulatoryMutation(() =>
    interactionsApi.record(contact.id, {
      interaction_date_ad: form.interaction_date_ad,
      kind: form.kind,
      rating: form.rating ? Number(form.rating) : null,
      summary: form.summary.trim(),
    }),
  );
  const valid = form.summary.trim().length >= 3 && form.interaction_date_ad && form.interaction_date_ad <= today();
  return (
    <BaseModal isOpen onClose={onClose} title={`History: ${contact.name}`} description={contact.organization ?? undefined} size="lg">
      <ol className="divide-y divide-line" aria-label="Interactions">
        {(history.data ?? []).map((i) => (
          <li key={i.id} className="py-3">
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
              {formatDate(i.interaction_date_ad)}
              {i.interaction_date_bs && <span className="text-xs font-normal text-muted">{i.interaction_date_bs} BS</span>}
              <Badge tone="neutral">{humanize(i.kind)}</Badge>
              {i.rating !== null && <span aria-label={`Rated ${i.rating} of 5`}>{'★'.repeat(i.rating)}{'☆'.repeat(5 - i.rating)}</span>}
            </p>
            <p className="text-sm">{i.summary}</p>
            <p className="text-xs text-muted">Recorded by {i.recorded_by ?? 'unknown'}</p>
          </li>
        ))}
        {history.data?.length === 0 && <li className="py-3 text-sm text-muted">Nothing recorded yet.</li>}
      </ol>
      {canRecord && (
        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-line pt-4 sm:grid-cols-3">
          <h3 className="font-semibold sm:col-span-3">Record an interaction</h3>
          <Input label="Date" type="date" max={today()} value={form.interaction_date_ad} onChange={(e) => set('interaction_date_ad', e.target.value)} />
          <Select label="Kind" value={form.kind} onChange={(e) => set('kind', e.target.value)} options={INTERACTION_KINDS.map((k) => ({ value: k, label: humanize(k) }))} />
          <Select
            label="How it went"
            value={form.rating}
            onChange={(e) => set('rating', e.target.value)}
            options={[{ value: '', label: 'Not rated' }, ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} of 5` }))]}
          />
          <Input label="What happened" className="sm:col-span-3" value={form.summary} onChange={(e) => set('summary', e.target.value)} />
          <div className="sm:col-span-3">
            <Button
              disabled={!valid}
              loading={record.isPending}
              onClick={() => record.mutate(undefined, { onSuccess: () => setForm({ interaction_date_ad: today(), kind: 'meeting', rating: '', summary: '' }) })}
            >
              Record interaction
            </Button>
          </div>
          {record.isError && <p className="text-sm text-danger sm:col-span-3">{getErrorMessage(record.error)}</p>}
        </div>
      )}
    </BaseModal>
  );
}

/** Who receives alerts, by type and urgency. Admins maintain the list; others see it. */
export function StakeholderContacts() {
  const roles = useAuthStore((state) => state.user?.roles ?? []);
  const isAdmin = roles.includes('admin');
  const contacts = useStakeholders(true);
  const [editing, setEditing] = useState<StakeholderContact | 'new' | null>(null);
  const [deleting, setDeleting] = useState<StakeholderContact | null>(null);
  const [viewing, setViewing] = useState<StakeholderContact | null>(null);
  const canRecord = isAdmin || roles.includes('maker');
  const remove = useRegulatoryMutation((id: string) => stakeholdersApi.remove(id));

  const columns: Column<StakeholderContact>[] = [
    { key: 'name', header: 'Contact', render: (c) => <span>{c.name}<span className="block text-xs text-muted">{c.organization ?? '—'}</span></span> },
    { key: 'email', header: 'Email', hideOnMobile: true, render: (c) => c.email },
    { key: 'types', header: 'Alerts', render: (c) => (c.alert_types ?? []).map(humanize).join(', ') || 'None' },
    { key: 'urgency', header: 'From', hideOnMobile: true, render: (c) => (c.min_urgency === 'critical' ? 'Critical' : 'Warning') },
    { key: 'active', header: 'Status', render: (c) => <Badge tone={c.is_active ? 'success' : 'neutral'}>{c.is_active ? 'Active' : 'Inactive'}</Badge> },
    {
      key: 'history',
      header: 'History',
      render: (c) => (
        <Button variant="ghost" size="sm" onClick={() => setViewing(c)} aria-label={`History of ${c.name}`}>
          {c.interaction_count ? `${c.interaction_count} · ${c.average_rating ?? '—'} of 5` : 'None yet'}
        </Button>
      ),
    },
    ...(isAdmin
      ? [{
          key: 'actions',
          header: '',
          align: 'right' as const,
          render: (c: StakeholderContact) => (
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(c)}>Edit</Button>
              <Button variant="ghost" size="sm" onClick={() => setDeleting(c)}>Remove</Button>
            </div>
          ),
        }]
      : []),
  ];

  return (
    <>
      <Card className="mt-6">
        <CardHeader
          title="Stakeholder contacts"
          description="Who is alerted, and about what"
          actions={isAdmin ? <Button variant="secondary" size="sm" onClick={() => setEditing('new')}>Add contact</Button> : undefined}
        />
        <CardBody>
          {contacts.isError ? (
            <ErrorState error={contacts.error} onRetry={() => contacts.refetch()} />
          ) : (
            <DataTable
              caption="Stakeholder contacts"
              columns={columns}
              rows={contacts.data ?? []}
              rowKey={(c) => c.id}
              empty={<EmptyState title="No stakeholder contacts" description={isAdmin ? 'Add the people who should receive alerts.' : undefined} />}
            />
          )}
        </CardBody>
      </Card>
      {editing && <ContactModal contact={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {viewing && <HistoryModal contact={viewing} canRecord={canRecord} onClose={() => setViewing(null)} />}
      {deleting && (
        <ConfirmationModal
          isOpen
          isDangerous
          title="Remove this contact?"
          message={`${deleting.name} will stop receiving alerts. To pause alerts without removing them, edit the contact and clear Active.`}
          confirmText="Remove contact"
          isLoading={remove.isPending}
          onClose={() => setDeleting(null)}
          onConfirm={() => remove.mutateAsync(deleting.id).then(() => setDeleting(null))}
        />
      )}
    </>
  );
}
