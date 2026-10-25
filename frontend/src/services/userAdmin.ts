/** Admin user management (RFP FUNC A.2): block, unblock, and set the role HPMS uses for a user. */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export const ROLES = ['admin', 'maker', 'approver', 'auditor', 'guest'] as const;

/** Fields the users list carries beyond the shared account type. */
export interface AccountAdminFields {
  directory_role?: string;
  role_override?: string | null;
  status_reason?: string | null;
}

export type UserChange =
  | { kind: 'block' | 'unblock'; userId: string; reason: string }
  | { kind: 'role'; userId: string; role: string | null; reason: string };

function send(change: UserChange) {
  const base = `/api/v1/admin/users/${change.userId}`;
  if (change.kind === 'role') return api.post(`${base}/role`, { role: change.role, reason: change.reason });
  return api.post(`${base}/${change.kind}`, { reason: change.reason });
}

export function useUserChange() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}
