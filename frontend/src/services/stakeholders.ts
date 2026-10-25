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
  /** Performance history in brief (RFP C.9). */
  interaction_count?: number;
  average_rating?: number | null;
  last_interaction_ad?: string | null;
}

export const INTERACTION_KINDS = ['meeting', 'call', 'letter', 'email', 'site_visit', 'other'] as const;

export interface StakeholderInteraction {
  id: string;
  interaction_date_ad: string;
  interaction_date_bs: string | null;
  kind: string;
  rating: number | null;
  summary: string;
  recorded_by: string | null;
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

export const interactionsApi = {
  list: (contactId: string) =>
    api
      .get<{ interactions: StakeholderInteraction[] }>(`/api/v1/stakeholders/${contactId}/interactions`)
      .then((r) => r.data.interactions),
  record: (contactId: string, body: Omit<StakeholderInteraction, 'id' | 'interaction_date_bs' | 'recorded_by'>) =>
    api.post<StakeholderInteraction>(`/api/v1/stakeholders/${contactId}/interactions`, body).then((r) => r.data),
};

export function useInteractions(contactId: string) {
  return useQuery({ queryKey: ['regulatory', 'stakeholders', contactId, 'interactions'], queryFn: () => interactionsApi.list(contactId) });
}
