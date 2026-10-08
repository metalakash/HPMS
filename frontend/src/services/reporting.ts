/** Report builder, regulatory calendar and reminders: API calls and their React Query hooks. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

// ---- Report builder

export interface ReportSource {
  key: string;
  label: string;
  columns: string[];
  filters: string[];
}

export interface ReportFilters {
  province?: string;
  district?: string;
  local_level?: string;
  status?: string;
  facility_type?: string;
  date_range_start?: string;
  date_range_end?: string;
}

export type ReportFileFormat = 'csv' | 'excel' | 'word';

export interface ReportRequest {
  source: string;
  columns: string[] | null;
  filters: ReportFilters | null;
  sort_by?: string | null;
  sort_desc?: boolean;
}

export interface ReportDefinition extends ReportRequest {
  id: string;
  name: string;
  description: string | null;
  default_format: 'json' | ReportFileFormat;
  is_shared: boolean;
  owner: string;
}

export interface ReportPreview {
  source: string;
  record_count: number;
  generated_at: string;
  data: Record<string, unknown>[];
}

const EXTENSIONS: Record<ReportFileFormat, string> = { csv: 'csv', excel: 'xlsx', word: 'docx' };

/** Drops empty filter values; null when nothing is left, which the API reads as "no filter". */
export function cleanFilters(filters: ReportFilters | null | undefined): ReportFilters | null {
  const entries = Object.entries(filters ?? {}).filter(([, value]) => value);
  return entries.length ? (Object.fromEntries(entries) as ReportFilters) : null;
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export const reportsApi = {
  sources: () => api.get<{ sources: ReportSource[] }>('/api/v1/reports/sources').then((r) => r.data.sources),
  definitions: () =>
    api.get<{ definitions: ReportDefinition[] }>('/api/v1/reports/definitions').then((r) => r.data.definitions),
  preview: (request: ReportRequest) =>
    api
      .post<ReportPreview>('/api/v1/reports/builder/run', { ...request, format: 'json' })
      .then((r) => r.data),
  /** Runs the report and saves the file the server returns. A report with no rows answers 404. */
  download: async (request: ReportRequest, format: ReportFileFormat, name: string) => {
    const response = await api.post<Blob>(
      '/api/v1/reports/builder/run',
      { ...request, format },
      { responseType: 'blob' },
    );
    save(response.data, `${name.replace(/[^\w-]+/g, '_')}.${EXTENSIONS[format]}`);
  },
  create: (body: ReportRequest & { name: string; is_shared: boolean }) =>
    api.post<ReportDefinition>('/api/v1/reports/definitions', body).then((r) => r.data),
  remove: (id: string) => api.delete(`/api/v1/reports/definitions/${id}`),
};

export function useReportSources() {
  return useQuery({ queryKey: ['reports', 'sources'], queryFn: reportsApi.sources });
}

export function useReportDefinitions() {
  return useQuery({ queryKey: ['reports', 'definitions'], queryFn: reportsApi.definitions });
}

export function useSaveReport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: reportsApi.create,
    onSuccess: () => client.invalidateQueries({ queryKey: ['reports', 'definitions'] }),
  });
}

export function useDeleteReport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: reportsApi.remove,
    onSuccess: () => client.invalidateQueries({ queryKey: ['reports', 'definitions'] }),
  });
}

// ---- Regulatory calendar

export const AUTHORITIES = ['NRB', 'MOEWRI', 'NEA', 'DOED', 'ERC', 'OTHER'] as const;
export const FREQUENCIES = ['monthly', 'quarterly', 'semi_annual', 'annual'] as const;
export type FilingStatus = 'pending' | 'filed' | 'overdue' | 'waived';

export interface Requirement {
  id: string;
  code: string;
  title: string;
  authority: (typeof AUTHORITIES)[number];
  description: string | null;
  legal_reference: string | null;
  frequency: (typeof FREQUENCIES)[number];
  lag_days: number;
  applies_to: 'portfolio' | 'project';
  is_active: boolean;
}

export type RequirementInput = Omit<Requirement, 'id' | 'is_active' | 'description'>;

export interface Filing {
  id: string;
  requirement_id: string;
  requirement_code: string;
  title: string;
  authority: string;
  project_id: string | null;
  period_label: string;
  period_end_ad: string | null;
  due_date_ad: string | null;
  due_date_bs: string | null;
  status: FilingStatus;
  filed_date_ad: string | null;
  reference_no: string | null;
  assigned_to: string | null;
  remarks: string | null;
}

export const regulatoryApi = {
  requirements: () =>
    api.get<{ requirements: Requirement[] }>('/api/v1/regulatory/requirements').then((r) => r.data.requirements),
  createRequirement: (body: RequirementInput) =>
    api.post<Requirement>('/api/v1/regulatory/requirements', body).then((r) => r.data),
  generate: (requirementId: string, from_date: string, to_date: string) =>
    api
      .post<{ requirement: string; created: number }>(
        `/api/v1/regulatory/requirements/${requirementId}/generate`,
        { from_date, to_date },
      )
      .then((r) => r.data),
  calendar: (status?: FilingStatus | '') =>
    api
      .get<{ filings: Filing[] }>('/api/v1/regulatory/calendar', { params: status ? { status } : {} })
      .then((r) => r.data.filings),
  recordFiling: (id: string, reference_no: string, filed_date_ad: string) =>
    api
      .patch<Filing>(`/api/v1/regulatory/calendar/${id}`, { status: 'filed', reference_no, filed_date_ad })
      .then((r) => r.data),
};

export function useRequirements(enabled: boolean) {
  return useQuery({ queryKey: ['regulatory', 'requirements'], queryFn: regulatoryApi.requirements, enabled });
}

export function useFilings(status: FilingStatus | '', enabled: boolean) {
  return useQuery({
    queryKey: ['regulatory', 'calendar', status],
    queryFn: () => regulatoryApi.calendar(status),
    enabled,
  });
}

/** Any change to requirements or filings refreshes both lists. */
export function useRegulatoryMutation<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => client.invalidateQueries({ queryKey: ['regulatory'] }),
  });
}

// ---- Reminders

export interface Reminder {
  id: string;
  title: string;
  note: string | null;
  remind_on_ad: string;
  remind_on_bs: string | null;
  status: 'active' | 'sent' | 'dismissed';
}

export const remindersApi = {
  list: () => api.get<{ reminders: Reminder[] }>('/api/v1/reminders').then((r) => r.data.reminders),
  create: (body: { title: string; remind_on_ad: string; note?: string }) =>
    api.post<Reminder>('/api/v1/reminders', body).then((r) => r.data),
  dismiss: (id: string) =>
    api.patch<Reminder>(`/api/v1/reminders/${id}`, { status: 'dismissed' }).then((r) => r.data),
};

export function useReminders() {
  return useQuery({ queryKey: ['reminders'], queryFn: remindersApi.list });
}

export function useReminderMutation<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => client.invalidateQueries({ queryKey: ['reminders'] }),
  });
}
