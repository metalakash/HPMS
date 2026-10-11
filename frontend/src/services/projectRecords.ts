/** Per-project records: insurance (E.11), ESIA monitoring (E.17) and community engagements and grievances (E.18). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiResponse } from '@/types/api';
import { api } from './api';

export interface InsurancePolicy {
  id: string;
  policy_number: string;
  insurer: string;
  policy_type: string;
  sum_insured_npr: string | null;
  premium_npr: string | null;
  valid_from_ad: string;
  valid_to_ad: string;
  status: 'active' | 'expired' | 'renewed' | 'cancelled';
}

export interface EsiaRecord {
  id: string;
  monitoring_date_ad: string;
  parameter: string;
  finding: string | null;
  compliance_status: 'compliant' | 'non_compliant' | 'observation';
  corrective_action: string | null;
}

export interface CommunityRecord {
  id: string;
  engagement_type: 'consultation' | 'grievance';
  engagement_date_ad: string;
  stakeholder_group: string | null;
  summary: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  resolution: string | null;
  resolved_date_ad: string | null;
}

export interface MilestoneRecord {
  id: string;
  name: string;
  category: string | null;
  planned_date_ad: string;
  forecast_date_ad: string | null;
  actual_date_ad: string | null;
  status: 'planned' | 'in_progress' | 'completed' | 'delayed';
  percent_complete: string;
  remarks: string | null;
}

export interface RiskRecord {
  id: string;
  title: string;
  description: string | null;
  risk_type: 'financial' | 'technical' | 'legal' | 'environmental' | 'social' | 'climate';
  likelihood: number;
  impact: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  mitigation_action: string | null;
  mitigation_owner: string | null;
  mitigation_due_ad: string | null;
  mitigation_status: 'open' | 'in_progress' | 'mitigated' | 'accepted';
  trigger_source: string | null;
}

export type RecordPath =
  | 'insurance'
  | 'esia-monitoring'
  | 'community-engagements'
  | 'milestones'
  | 'risks';

export const RISK_TYPES = ['financial', 'technical', 'legal', 'environmental', 'social', 'climate'] as const;

export const POLICY_TYPES = ['CAR', 'operational_all_risk', 'third_party', 'business_interruption'] as const;

const base = (projectId: string, path: RecordPath) => `/api/v1/projects/${projectId}/${path}`;

export const recordsApi = {
  list: <T>(projectId: string, path: RecordPath) =>
    api.get<ApiResponse<T[]>>(base(projectId, path)).then((r) => r.data.data),
  create: <T, B>(projectId: string, path: RecordPath, body: B) =>
    api.post<ApiResponse<T>>(base(projectId, path), body).then((r) => r.data.data),
  update: <T, B>(projectId: string, path: RecordPath, id: string, body: B) =>
    api.patch<ApiResponse<T>>(`${base(projectId, path)}/${id}`, body).then((r) => r.data.data),
  /** Raises risks from milestone delays and covenant breaches; returns how many were new. */
  scanRisks: (projectId: string) =>
    api.post<ApiResponse<{ risks_created: number }>>(`${base(projectId, 'risks')}/auto-scan`).then((r) => r.data.data),
};

export function useProjectRecords<T>(projectId: string, path: RecordPath) {
  return useQuery({
    queryKey: ['project-records', path, projectId],
    queryFn: () => recordsApi.list<T>(projectId, path),
  });
}

/** A write to one kind of record refreshes that kind's list for the project. */
export function useRecordMutation<TArgs, TResult>(
  projectId: string,
  path: RecordPath,
  mutationFn: (args: TArgs) => Promise<TResult>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => client.invalidateQueries({ queryKey: ['project-records', path, projectId] }),
  });
}
