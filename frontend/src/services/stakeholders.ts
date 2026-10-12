/** Stakeholder contacts for alert routing (RFP C.9). Reading needs portfolio access; writing needs admin. */
import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export const ALERT_TYPES = ['PPA', 'LICENSE', 'INSURANCE', 'PERMIT', 'MILESTONE', 'FILING'] as const;

export interface StakeholderContact {
  id: string;
  name: string;
  organization: string | null;
  role: string | null;
  category: 'internal' | 'external';
  email: string;
  phone: string | null;
  alert_types: string[] | null;
  min_urgency: 'warning' | 'critical';
  is_active: boolean;
  project_id: string | null;
}

export interface StakeholderInput {
  name: string;
  organization: string | null;
  role: string | null;
  category: 'internal' | 'external';
  email: string;
  phone: string | null;
  alert_types: string[] | null;
  min_urgency: 'warning' | 'critical';
  is_active: boolean;
}

export const stakeholdersApi = {
  list: () =>
    api.get<{ contacts: StakeholderContact[] }>('/api/v1/stakeholders').then((r) => r.data.contacts),
  create: (body: StakeholderInput) =>
    api.post<StakeholderContact>('/api/v1/stakeholders', body).then((r) => r.data),
  update: (id: string, body: Partial<StakeholderInput>) =>
    api.patch<StakeholderContact>(`/api/v1/stakeholders/${id}`, body).then((r) => r.data),
  remove: (id: string) => api.delete(`/api/v1/stakeholders/${id}`),
};

export function useStakeholders(enabled: boolean) {
  return useQuery({ queryKey: ['regulatory', 'stakeholders'], queryFn: stakeholdersApi.list, enabled });
}
