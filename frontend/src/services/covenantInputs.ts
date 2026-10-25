/** Covenant inputs (a quarter's reported figures, a project's sanction terms): read and propose. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export const PERIOD_AMOUNTS = [
  { key: 'revenue_npr', label: 'Revenue' },
  { key: 'operating_expenses_npr', label: 'Operating expenses' },
  { key: 'royalty_npr', label: 'Royalty' },
  { key: 'tax_paid_npr', label: 'Tax paid' },
  { key: 'depreciation_npr', label: 'Depreciation' },
  { key: 'security_value_npr', label: 'Value of security at period end' },
] as const;
export type PeriodAmountKey = (typeof PERIOD_AMOUNTS)[number]['key'];

export const TERM_FIELDS = [
  { key: 'dscr_min', label: 'Minimum DSCR', unit: 'x' },
  { key: 'icr_min', label: 'Minimum ICR', unit: 'x' },
  { key: 'ltv_max', label: 'Maximum LTV', unit: '%' },
  { key: 'warning_margin_pct', label: 'Warning margin', unit: '%' },
] as const;
export type TermKey = (typeof TERM_FIELDS)[number]['key'];

export type ReportedPeriod = { quarter: string; is_audited: boolean; source_reference: string | null } & Record<
  PeriodAmountKey,
  string | null
>;

export interface CovenantInputs {
  project_id: string;
  reportable_quarters: { quarter: string; period_end_ad: string; reported: boolean }[];
  terms: Record<TermKey, string> & { source: string; source_reference: string | null };
  periods: ReportedPeriod[];
}

export type CovenantInputKind = 'FINANCIAL_PERIOD' | 'COVENANT_TERMS';

export const covenantInputsApi = {
  get: (projectId: string) =>
    api
      .get<{ data: CovenantInputs }>(`/api/v1/compliance/covenants/${projectId}/financials`)
      .then((r) => r.data.data),
  /** Covenant inputs never change directly: this raises a change request for two checkers. */
  propose: (kind: CovenantInputKind, projectId: string, changes: Record<string, unknown>, justification: string) =>
    api
      .post('/api/v1/mutations/submit-with-justification', {
        entity_type: kind,
        entity_id: projectId,
        action: 'UPDATE',
        changes,
        justification,
      })
      .then((r) => r.data),
};

export function useCovenantInputs(projectId: string) {
  return useQuery({
    queryKey: ['covenants', projectId, 'inputs'],
    queryFn: () => covenantInputsApi.get(projectId),
  });
}

export function useProposeCovenantInput(kind: CovenantInputKind, projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ changes, justification }: { changes: Record<string, unknown>; justification: string }) =>
      covenantInputsApi.propose(kind, projectId, changes, justification),
    onSuccess: () => client.invalidateQueries({ queryKey: ['approvals'] }),
  });
}

/** Amounts are typed as text; blank means "not reported" and is left out of the request. */
export function amountsFrom(form: Partial<Record<string, string>>, keys: readonly string[]): Record<string, string> {
  return Object.fromEntries(
    keys.map((key) => [key, (form[key] ?? '').trim()] as const).filter(([, value]) => value !== ''),
  );
}

export const isAmount = (value: string) => /^\d+(\.\d{1,2})?$/.test(value.trim());
