import { useState } from 'react';
import { AlertCircle, CalendarClock, CheckCircle } from 'lucide-react';
import { Badge, type BadgeTone } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card, CardBody, CardHeader } from '@/components/common/Card';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Input, Select } from '@/components/common/Field';
import { Skeleton } from '@/components/common/Skeleton';
import { StatCard } from '@/components/common/StatCard';
import { EmptyState, ErrorState } from '@/components/common/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { BaseModal } from '@/components/modals/BaseModal';
import { getErrorMessage } from '@/services/api';
import {
  AUTHORITIES,
  FREQUENCIES,
  regulatoryApi,
  remindersApi,
  useFilings,
  useRegulatoryMutation,
  useReminderMutation,
  useReminders,
  useRequirements,
  type Filing,
  type FilingStatus,
  type Requirement,
  type RequirementInput,
} from '@/services/reporting';
import { useAuthStore } from '@/store/useAuthStore';
import { formatDate, humanize } from '@/utils/format';

const STATUS_TONE: Record<FilingStatus, BadgeTone> = {
  pending: 'neutral',
  filed: 'success',
  overdue: 'danger',
  waived: 'info',
};
const today = () => new Date().toISOString().slice(0, 10);
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

function RecordFilingModal({ filing, onClose }: { filing: Filing; onClose: () => void }) {
  const [reference, setReference] = useState('');
  const [filedOn, setFiledOn] = useState(today());
  const record = useRegulatoryMutation(() => regulatoryApi.recordFiling(filing.id, reference.trim(), filedOn));
  return (
    <BaseModal
      isOpen
      onClose={onClose}
      title="Record filing"
      description={`${filing.title}, ${filing.period_label}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!reference.trim()}
            loading={record.isPending}
            onClick={() => record.mutate(undefined, { onSuccess: onClose })}
          >
            Mark as filed
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <Input label="Regulator's reference number" value={reference} onChange={(event) => setReference(event.target.value)} />
        <Input label="Filed on" type="date" max={today()} value={filedOn} onChange={(event) => setFiledOn(event.target.value)} />
        {record.isError && <p role="alert" className="text-sm text-danger">{getErrorMessage(record.error)}</p>}
      </div>
    </BaseModal>
  );
}

function RequirementModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<RequirementInput>({
    code: '', title: '', authority: 'NRB', legal_reference: null, frequency: 'quarterly', lag_days: 30, applies_to: 'portfolio',
  });
  const create = useRegulatoryMutation(() => regulatoryApi.createRequirement({ ...form, code: form.code.trim(), title: form.title.trim() }));
  const set = <K extends keyof RequirementInput>(key: K, value: RequirementInput[K]) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <BaseModal
      isOpen
      onClose={onClose}
      title="Add a filing requirement"
      description="Enter it as the regulator's directive states it. HPMS ships with none."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!form.code.trim() || !form.title.trim()}
            loading={create.isPending}
            onClick={() => create.mutate(undefined, { onSuccess: onClose })}
          >
            Add requirement
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Code" value={form.code} onChange={(event) => set('code', event.target.value)} />
        <Select label="Authority" value={form.authority} onChange={(event) => set('authority', event.target.value as Requirement['authority'])} options={AUTHORITIES.map((a) => ({ value: a, label: a }))} />
        <Input label="Title" className="sm:col-span-2" value={form.title} onChange={(event) => set('title', event.target.value)} />
        <Select label="Frequency" value={form.frequency} onChange={(event) => set('frequency', event.target.value as Requirement['frequency'])} options={FREQUENCIES.map((f) => ({ value: f, label: humanize(f) }))} />
        <Input label="Days after period end" type="number" min={0} max={366} value={form.lag_days} onChange={(event) => set('lag_days', Number(event.target.value))} />
        <Input label="Legal reference (optional)" className="sm:col-span-2" value={form.legal_reference ?? ''} onChange={(event) => set('legal_reference', event.target.value || null)} />
        {create.isError && <p role="alert" className="text-sm text-danger sm:col-span-2">{getErrorMessage(create.error)}</p>}
      </div>
    </BaseModal>
  );
}

function Reminders() {
  const reminders = useReminders();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(inDays(7));
  const create = useReminderMutation(() => remindersApi.create({ title: title.trim(), remind_on_ad: date }));
  const dismiss = useReminderMutation(remindersApi.dismiss);
  const active = (reminders.data ?? []).filter((r) => r.status !== 'dismissed');
  return (
    <Card>
      <CardHeader title="My reminders" description="Emailed to you on the day" />
      <CardBody className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <Input label="Remind me to" className="min-w-40 flex-1" value={title} onChange={(event) => setTitle(event.target.value)} />
          <Input label="On" type="date" min={today()} value={date} onChange={(event) => setDate(event.target.value)} />
          <Button
            variant="secondary"
            disabled={!title.trim() || !date}
            loading={create.isPending}
            onClick={() => create.mutate(undefined, { onSuccess: () => setTitle('') })}
          >
            Add
          </Button>
        </div>
        {create.isError && <p role="alert" className="text-sm text-danger">{getErrorMessage(create.error)}</p>}
        {reminders.isError ? (
          <ErrorState error={reminders.error} onRetry={() => void reminders.refetch()} />
        ) : !reminders.data ? (
          <Skeleton className="h-16 w-full" />
        ) : active.length === 0 ? (
          <p className="text-sm text-muted">No reminders set.</p>
        ) : (
          <ul aria-label="Reminders" className="divide-y divide-line">
            {active.map((reminder) => (
              <li key={reminder.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  {reminder.title}
                  <span className="block text-xs text-muted">
                    {formatDate(reminder.remind_on_ad)}
                    {reminder.remind_on_bs && ` · ${reminder.remind_on_bs} BS`}
                    {reminder.status === 'sent' && ' · sent'}
                  </span>
                </span>
                <Button variant="ghost" size="sm" onClick={() => dismiss.mutate(reminder.id)}>Dismiss</Button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

export default function RegulatoryPage() {
  const roles = useAuthStore((state) => state.user?.roles ?? []);
  const canView = roles.includes('admin') || roles.includes('auditor');
  const isAdmin = roles.includes('admin');
  const canFile = isAdmin || roles.includes('maker');

  const [status, setStatus] = useState<FilingStatus | ''>('');
  const filings = useFilings(status, canView);
  const everything = useFilings('', canView);
  const requirements = useRequirements(canView);
  const [recording, setRecording] = useState<Filing | null>(null);
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const generate = useRegulatoryMutation((requirement: Requirement) => {
    const year = new Date().getFullYear();
    return regulatoryApi.generate(requirement.id, `${year}-01-01`, `${year + 1}-12-31`);
  });

  const all = everything.data ?? [];
  const soon = inDays(30);
  const count = (wanted: FilingStatus) => all.filter((f) => f.status === wanted).length;
  const dueSoon = all.filter((f) => f.status === 'pending' && f.due_date_ad && f.due_date_ad <= soon).length;

  const columns: Column<Filing>[] = [
    {
      key: 'title',
      header: 'Filing',
      render: (filing) => (
        <>
          <span className="font-medium">{filing.title}</span>
          <span className="block text-xs text-muted">{filing.requirement_code} · {filing.authority}</span>
        </>
      ),
    },
    { key: 'period', header: 'Period', render: (filing) => filing.period_label },
    {
      key: 'due',
      header: 'Due',
      render: (filing) => (
        <>
          {formatDate(filing.due_date_ad)}
          {filing.due_date_bs && <span className="block text-xs text-muted">{filing.due_date_bs} BS</span>}
        </>
      ),
    },
    { key: 'status', header: 'Status', render: (filing) => <Badge tone={STATUS_TONE[filing.status]}>{humanize(filing.status)}</Badge> },
    { key: 'reference', header: 'Reference', hideOnMobile: true, render: (filing) => filing.reference_no ?? '—' },
    {
      key: 'action',
      header: '',
      render: (filing) =>
        canFile && (filing.status === 'pending' || filing.status === 'overdue') ? (
          <Button variant="secondary" size="sm" onClick={() => setRecording(filing)}>Record filing</Button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader title="Regulatory" description="Filings due to regulators, and your own reminders" />

      {canView && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Due in 30 days" icon={<CalendarClock className="size-4" />} value={dueSoon} loading={everything.isLoading} />
            <StatCard label="Overdue" icon={<AlertCircle className="size-4" />} value={count('overdue')} loading={everything.isLoading} />
            <StatCard label="Filed" icon={<CheckCircle className="size-4" />} value={count('filed')} loading={everything.isLoading} />
          </div>

          <Card className="mt-6">
            <CardHeader
              title="Filing calendar"
              description="Periods follow the Nepali fiscal year"
              actions={
                <Select
                  label="Status"
                  hideLabel
                  placeholder="All statuses"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as FilingStatus | '')}
                  options={(['pending', 'overdue', 'filed', 'waived'] as const).map((s) => ({ value: s, label: humanize(s) }))}
                />
              }
            />
            {filings.isError ? (
              <ErrorState error={filings.error} onRetry={() => void filings.refetch()} />
            ) : filings.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <DataTable
                caption="Filing calendar"
                columns={columns}
                rows={filings.data ?? []}
                rowKey={(filing) => filing.id}
                empty={
                  <EmptyState
                    title={status ? 'No filings in this state' : 'No filings on the calendar'}
                    description={status ? undefined : 'Add a requirement below and generate its calendar.'}
                  />
                }
              />
            )}
          </Card>
        </>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {canView && (
          <Card>
            <CardHeader
              title="Filing requirements"
              description="What must be filed, to whom and how often"
              actions={isAdmin ? <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>Add requirement</Button> : undefined}
            />
            {requirements.isError ? (
              <ErrorState error={requirements.error} onRetry={() => void requirements.refetch()} />
            ) : !requirements.data ? (
              <Skeleton className="h-24 w-full" />
            ) : requirements.data.length === 0 ? (
              <EmptyState
                title="No requirements recorded"
                description="HPMS ships with none: the compliance team enters each regulator's filings here."
              />
            ) : (
              <ul aria-label="Filing requirements" className="divide-y divide-line">
                {requirements.data.map((requirement) => (
                  <li key={requirement.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span>
                      <span className="font-medium">{requirement.title}</span>
                      <span className="block text-xs text-muted">
                        {requirement.code} · {requirement.authority} · {humanize(requirement.frequency)}, due {requirement.lag_days} days after period end
                      </span>
                    </span>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={generate.isPending && generate.variables?.id === requirement.id}
                        onClick={() =>
                          generate.mutate(requirement, {
                            onSuccess: (result) => setNote(`${result.created} filing${result.created === 1 ? '' : 's'} added for ${result.requirement}.`),
                            onError: (error) => setNote(getErrorMessage(error)),
                          })
                        }
                      >
                        Generate calendar
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {note && <p role="status" className="border-t border-line px-4 py-2 text-sm text-muted">{note}</p>}
          </Card>
        )}
        <Reminders />
      </div>

      {recording && <RecordFilingModal filing={recording} onClose={() => setRecording(null)} />}
      {adding && <RequirementModal onClose={() => setAdding(false)} />}
    </>
  );
}
