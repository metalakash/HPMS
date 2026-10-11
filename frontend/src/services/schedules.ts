/** Scheduled report delivery: export jobs, their run history and the admin actions on them (RFP F.11). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export type ExportFormat = 'csv' | 'excel' | 'word' | 'json';

export interface ReportSchedule {
  id: string;
  name: string;
  report_id: string;
  definition_id: string | null;
  export_format: ExportFormat;
  schedule: string;
  recipients: string[];
  filters: Record<string, unknown> | null;
  is_enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
}

export interface ScheduleRun {
  id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  record_count: number | null;
  emails_sent: number | null;
  error: string | null;
}

export interface ScheduleInput {
  name: string;
  schedule: string;
  export_format: ExportFormat;
  recipients: string[];
  report_id: string;
}

export const schedulesApi = {
  list: () => api.get<{ schedules: ReportSchedule[] }>('/api/v1/reports/schedules').then((r) => r.data.schedules),
  create: (body: ScheduleInput) =>
    api.post<ReportSchedule>('/api/v1/reports/schedules', body).then((r) => r.data),
  setEnabled: (id: string, is_enabled: boolean) =>
    api.patch<ReportSchedule>(`/api/v1/reports/schedules/${id}`, { is_enabled }).then((r) => r.data),
  remove: (id: string) => api.delete(`/api/v1/reports/schedules/${id}`),
  runNow: (id: string) => api.post<ScheduleRun>(`/api/v1/reports/schedules/${id}/run`).then((r) => r.data),
  runs: (id: string) => api.get<{ runs: ScheduleRun[] }>(`/api/v1/reports/schedules/${id}/runs`).then((r) => r.data.runs),
};

export function useSchedules() {
  return useQuery({ queryKey: ['reports', 'schedules'], queryFn: schedulesApi.list });
}

export function useScheduleRuns(id: string | null) {
  return useQuery({
    queryKey: ['reports', 'schedules', id, 'runs'],
    queryFn: () => schedulesApi.runs(id as string),
    enabled: id !== null,
  });
}

/** Any change to a schedule refreshes the list and its run history. */
export function useScheduleMutation<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => client.invalidateQueries({ queryKey: ['reports', 'schedules'] }),
  });
}

/** Common schedules, as cron expressions in UTC (the server evaluates them in UTC). */
export const SCHEDULE_PRESETS = [
  { value: '0 6 * * 1', label: 'Mondays at 06:00 UTC' },
  { value: '0 6 1 * *', label: 'First of each month at 06:00 UTC' },
  { value: '0 6 1 1,4,7,10 *', label: 'First of each quarter at 06:00 UTC' },
] as const;
