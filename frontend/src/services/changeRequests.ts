/**
 * Budgets, projection figures, settings and approval rules: read them, and propose changes. Nothing here
 * changes directly; every change is a request that checkers decide under its approval rule.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export type ChangeType = 'BUDGET_LINE' | 'LOAN_PROJECTION' | 'SETTING' | 'APPROVAL_RULE' | 'EXCHANGE_RATE' | 'BANK_IMPORT';

export interface BudgetLine {
  id: string;
  category: string;
  budgeted_amount: string;
  actual_amount: string;
  variance_amount: string | null;
  variance_pct: string | null;
}

export interface ProjectBudget {
  lines: BudgetLine[];
  totals: { budgeted_amount: string; actual_amount: string; variance_amount: string | null; variance_pct: string | null; overspent_lines: number };
}

export interface UploadPreview {
  lines: (Omit<BudgetLine, 'id'> & { id: string | null; change: 'add' | 'update' })[];
  errors: { row: number; message: string }[];
  upload_batch_id: string;
  file_name: string;
}

export interface ProjectionRow {
  fiscal_year: string;
  quarter: number;
  period_end_ad: string;
  period_end_bs: string | null;
  is_opening: boolean;
  projected_disbursement: string;
  projected_repayment: string;
  projected_outstanding: string;
  source_reference: string | null;
}

export interface AppSetting {
  name: string;
  group: string;
  label: string;
  description: string;
  unit: string;
  value: string;
  default: string;
  is_default: boolean;
  minimum: string;
  maximum: string;
  integer: boolean;
}

export interface ApprovalRule {
  entity_type: string;
  label: string;
  version: number;
  steps: string[];
  recommend_roles: string[];
  approve_roles: string[];
}

export interface RateEntry {
  rate_to_npr: string;
  effective_from_ad: string;
  effective_from_bs: string | null;
  source_reference: string | null;
}

export interface CurrencyRates {
  currency_code: string;
  current: RateEntry | null;
  history: RateEntry[];
}

const project = (projectId: string) => `/api/v1/projects/${projectId}`;

export const plansApi = {
  budget: (projectId: string) => api.get<{ data: ProjectBudget }>(`${project(projectId)}/budget`).then((r) => r.data.data),
  previewUpload: (projectId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api
      .post<{ data: UploadPreview }>(`${project(projectId)}/budget/preview`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data.data);
  },
  projection: (projectId: string) => api.get<{ data: ProjectionRow[] }>(`${project(projectId)}/projection`).then((r) => r.data.data),
  settings: () => api.get<{ data: AppSetting[] }>('/api/v1/admin/settings').then((r) => r.data.data),
  rules: () => api.get<{ data: ApprovalRule[] }>('/api/v1/admin/approval-rules').then((r) => r.data.data),
  rates: () => api.get<{ data: CurrencyRates[] }>('/api/v1/admin/exchange-rates').then((r) => r.data.data),
  propose: (entityType: ChangeType, entityId: string, changes: Record<string, unknown>, justification: string) =>
    api
      .post('/api/v1/mutations/submit-with-justification', {
        entity_type: entityType,
        entity_id: entityId,
        action: 'UPDATE',
        changes,
        justification,
      })
      .then((r) => r.data),
};

export const useBudget = (projectId: string) =>
  useQuery({ queryKey: ['projects', projectId, 'budget'], queryFn: () => plansApi.budget(projectId) });
export const useProjectProjection = (projectId: string | null) =>
  useQuery({ queryKey: ['projects', projectId, 'projection'], queryFn: () => plansApi.projection(projectId!), enabled: Boolean(projectId) });
export const useSettings = () => useQuery({ queryKey: ['admin', 'settings'], queryFn: plansApi.settings });
export const useApprovalRules = () => useQuery({ queryKey: ['admin', 'approval-rules'], queryFn: plansApi.rules });
export const useExchangeRates = () => useQuery({ queryKey: ['admin', 'exchange-rates'], queryFn: plansApi.rates });

/** Raise a change request; the approvals queue refreshes. */
export function useProposeChange(entityType: ChangeType) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ entityId, changes, justification }: { entityId: string; changes: Record<string, unknown>; justification: string }) =>
      plansApi.propose(entityType, entityId, changes, justification),
    onSuccess: () => client.invalidateQueries({ queryKey: ['approvals'] }),
  });
}

export const isAmount = (value: string) => /^\d+(\.\d{1,2})?$/.test(value.trim().replace(/,/g, ''));

export function formatNpr(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

/** Outstanding down the projection after edits: each quarter is the one before plus disbursement less repayment. */
export function carryDown(rows: ProjectionRow[], edits: Record<string, { disbursement: string; repayment: string }>): number[] {
  const result: number[] = [];
  rows.forEach((row, index) => {
    if (row.is_opening || index === 0) {
      result.push(Number(row.projected_outstanding));
      return;
    }
    const edit = edits[`${row.fiscal_year}-${row.quarter}`];
    const disbursement = Number(edit?.disbursement ?? row.projected_disbursement) || 0;
    const repayment = Number(edit?.repayment ?? row.projected_repayment) || 0;
    result.push(result[index - 1] + disbursement - repayment);
  });
  return result;
}
