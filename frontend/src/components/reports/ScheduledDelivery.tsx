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
import { useReportSources } from '@/services/reporting';
import {
  SCHEDULE_PRESETS,
  type ExportFormat,
  type ReportSchedule,
  type ScheduleInput,
  schedulesApi,
  useSchedules,
  useScheduleMutation,
  useScheduleRuns,
} from '@/services/schedules';
import { useAuthStore } from '@/store/useAuthStore';
import { formatDate, humanize } from '@/utils/format';

const FORMATS: ExportFormat[] = ['excel', 'csv', 'word', 'json'];
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const CUSTOM = 'custom';

function scheduleLabel(cron: string): string {
  return SCHEDULE_PRESETS.find((p) => p.value === cron)?.label ?? `Cron ${cron}`;
}

function AddScheduleModal({ onClose }: { onClose: () => void }) {
  const sources = useReportSources();
  const [name, setName] = useState('');
  const [reportId, setReportId] = useState('');
  const [format, setFormat] = useState<ExportFormat>('excel');
  const [preset, setPreset] = useState<string>(SCHEDULE_PRESETS[0].value);
  const [custom, setCustom] = useState('');
  const [recipients, setRecipients] = useState('');

  const cron = preset === CUSTOM ? custom.trim() : preset;
  const emails = recipients.split(',').map((e) => e.trim()).filter(Boolean);
  const badEmails = emails.filter((e) => !EMAIL.test(e));
  const valid = name.trim() && reportId && cron && emails.length > 0 && badEmails.length === 0;

  const create = useScheduleMutation((body: ScheduleInput) => schedulesApi.create(body));

  return (
    <BaseModal
      isOpen
      onClose={onClose}
      title="Schedule a report"
      description="Times are in UTC. Each run emails the report to the recipients."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!valid}
            loading={create.isPending}
            onClick={() =>
              create.mutate(
                { name: name.trim(), report_id: reportId, export_format: format, schedule: cron, recipients: emails },
                { onSuccess: onClose },
              )
            }
          >
            Schedule
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Name" className="sm:col-span-2" value={name} onChange={(e) => setName(e.target.value)} />
        <Select
          label="Report"
          value={reportId}
          placeholder="Choose a source"
          onChange={(e) => setReportId(e.target.value)}
          options={(sources.data ?? []).map((s) => ({ value: s.key, label: s.label }))}
        />
        <Select
          label="Format"
          value={format}
          onChange={(e) => setFormat(e.target.value as ExportFormat)}
          options={FORMATS.map((f) => ({ value: f, label: f.toUpperCase() }))}
        />
        <Select
          label="When"
          className="sm:col-span-2"
          value={preset}
          onChange={(e) => setPreset(e.target.value)}
          options={[...SCHEDULE_PRESETS, { value: CUSTOM, label: 'Custom cron expression (UTC)' }]}
        />
        {preset === CUSTOM && (
          <Input label="Cron expression" className="sm:col-span-2" placeholder="0 6 * * 1" value={custom} onChange={(e) => setCustom(e.target.value)} />
        )}
        <Input
          label="Recipients (comma separated)"
          className="sm:col-span-2"
          value={recipients}
          onChange={(e) => setRecipients(e.target.value)}
          error={badEmails.length ? `Not an email address: ${badEmails.join(', ')}` : undefined}
        />
      </div>
      {create.isError && <p className="mt-3 text-sm text-danger">{getErrorMessage(create.error)}</p>}
    </BaseModal>
  );
}

function RunHistory({ schedule }: { schedule: ReportSchedule }) {
  const runs = useScheduleRuns(schedule.id);
  return (
    <Card className="mt-4">
      <CardHeader title={`Runs of ${schedule.name}`} description="The 50 most recent" />
      <CardBody>
        {runs.isError ? (
          <ErrorState error={runs.error} onRetry={() => runs.refetch()} />
        ) : (
          <DataTable
            caption={`Runs of ${schedule.name}`}
            rows={runs.data ?? []}
            rowKey={(r) => r.id}
            columns={[
              { key: 'started', header: 'Started', render: (r) => formatDate(r.started_at) },
              { key: 'status', header: 'Status', render: (r) => <Badge tone={r.status === 'success' ? 'success' : r.status === 'failed' ? 'danger' : 'neutral'}>{humanize(r.status)}</Badge> },
              { key: 'records', header: 'Records', align: 'right', hideOnMobile: true, render: (r) => r.record_count ?? '—' },
              { key: 'emails', header: 'Emails sent', align: 'right', hideOnMobile: true, render: (r) => r.emails_sent ?? '—' },
              { key: 'error', header: 'Error', hideOnMobile: true, render: (r) => r.error ?? '—' },
            ]}
            empty={<EmptyState title="No runs yet" />}
          />
        )}
      </CardBody>
    </Card>
  );
}

/** Scheduled report delivery. Everyone who can see reports sees the schedules; only admins change them. */
export function ScheduledDelivery() {
  const roles = useAuthStore((state) => state.user?.roles ?? []);
  const isAdmin = roles.includes('admin');
  const schedules = useSchedules();
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<ReportSchedule | null>(null);
  const [deleting, setDeleting] = useState<ReportSchedule | null>(null);
  const toggle = useScheduleMutation((args: { id: string; enabled: boolean }) => schedulesApi.setEnabled(args.id, args.enabled));
  const remove = useScheduleMutation((id: string) => schedulesApi.remove(id));
  const runNow = useScheduleMutation((id: string) => schedulesApi.runNow(id));
  const sources = useReportSources();
  const sourceLabel = (key: string) => sources.data?.find((s) => s.key === key)?.label ?? humanize(key);

  const columns: Column<ReportSchedule>[] = [
    { key: 'name', header: 'Schedule', render: (s) => s.name },
    { key: 'report', header: 'Report', hideOnMobile: true, render: (s) => sourceLabel(s.report_id) },
    { key: 'when', header: 'When', render: (s) => scheduleLabel(s.schedule) },
    { key: 'format', header: 'Format', hideOnMobile: true, render: (s) => s.export_format.toUpperCase() },
    { key: 'next', header: 'Next run', hideOnMobile: true, render: (s) => (s.is_enabled ? formatDate(s.next_run_at) : 'Paused') },
    {
      key: 'state',
      header: 'State',
      render: (s) =>
        isAdmin ? (
          <Button variant="secondary" size="sm" loading={toggle.isPending} onClick={() => toggle.mutate({ id: s.id, enabled: !s.is_enabled })}>
            {s.is_enabled ? 'Pause' : 'Resume'}
          </Button>
        ) : (
          <Badge tone={s.is_enabled ? 'success' : 'neutral'}>{s.is_enabled ? 'Active' : 'Paused'}</Badge>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (s) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setViewing(s)}>History</Button>
          {isAdmin && (
            <>
              <Button variant="ghost" size="sm" loading={runNow.isPending && runNow.variables === s.id} onClick={() => runNow.mutate(s.id)}>Run now</Button>
              <Button variant="ghost" size="sm" onClick={() => setDeleting(s)}>Delete</Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <Card className="mt-6">
        <CardHeader
          title="Scheduled delivery"
          description="Reports emailed on a timetable"
          actions={isAdmin ? <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>Schedule a report</Button> : undefined}
        />
        <CardBody>
          {schedules.isError ? (
            <ErrorState error={schedules.error} onRetry={() => schedules.refetch()} />
          ) : (
            <DataTable
              caption="Scheduled reports"
              columns={columns}
              rows={schedules.data ?? []}
              rowKey={(s) => s.id}
              empty={<EmptyState title="No scheduled reports" description={isAdmin ? 'Schedule one to have it emailed automatically.' : undefined} />}
            />
          )}
          {(toggle.isError || runNow.isError || remove.isError) && (
            <p className="mt-3 text-sm text-danger">{getErrorMessage(toggle.error ?? runNow.error ?? remove.error)}</p>
          )}
          {runNow.isSuccess && <p className="mt-3 text-sm text-muted">Run finished. See its history for the result.</p>}
        </CardBody>
      </Card>
      {viewing && <RunHistory schedule={viewing} />}
      {adding && <AddScheduleModal onClose={() => setAdding(false)} />}
      {deleting && (
        <ConfirmationModal
          isOpen
          isDangerous
          title="Delete this schedule?"
          message={`"${deleting.name}" will stop being emailed. Its run history is kept.`}
          confirmText="Delete schedule"
          isLoading={remove.isPending}
          onClose={() => setDeleting(null)}
          onConfirm={() => remove.mutateAsync(deleting.id).then(() => setDeleting(null))}
        />
      )}
    </>
  );
}
