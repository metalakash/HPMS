import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect } from 'react';
import { authApi, loansApi, mutationsApi, projectsApi } from '@/services/endpoints';
import { useAuthStore } from '@/store/useAuthStore';
import type {
  ApprovalQueueFilters,
  ChangeRequest,
  LoanFilters,
  ProjectFilters,
  ProjectStage,
} from '@/types/api';

/** Central query keys so WebSocket events can invalidate by prefix. */
export const queryKeys = {
  projects: ['projects'] as const,
  projectList: (filters: ProjectFilters) => ['projects', 'list', filters] as const,
  project: (id: string) => ['projects', 'detail', id] as const,
  projectLoans: (id: string) => ['projects', 'detail', id, 'loans'] as const,
  projectDisbursements: (id: string) => ['projects', 'detail', id, 'disbursements'] as const,
  projectMilestones: (id: string) => ['projects', 'detail', id, 'milestones'] as const,
  projectRisks: (id: string) => ['projects', 'detail', id, 'risks'] as const,
  me: ['auth', 'me'] as const,
  loans: ['loans'] as const,
  loanList: (filters: LoanFilters) => ['loans', 'list', filters] as const,
  projectTab: (id: string, tab: string) => ['projects', 'detail', id, tab] as const,
  approvals: ['approvals'] as const,
  approvalQueue: (filters: ApprovalQueueFilters) => ['approvals', 'queue', filters] as const,
};

/**
 * Confirms the stored token with the server once per session and keeps the
 * profile current. A stale or pre-upgrade token gets a 401, which the API
 * interceptor turns into a logout.
 */
export function useSessionCheck() {
  const setUser = useAuthStore((s) => s.setUser);
  const { data } = useQuery({ queryKey: queryKeys.me, queryFn: authApi.me, staleTime: Infinity });
  useEffect(() => {
    if (data) setUser(data);
  }, [data, setUser]);
}

export function useProjects(filters: ProjectFilters) {
  return useQuery({
    queryKey: queryKeys.projectList(filters),
    queryFn: () => projectsApi.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useProject(id: string) {
  return useQuery({ queryKey: queryKeys.project(id), queryFn: () => projectsApi.get(id) });
}

export function useProjectLoans(id: string) {
  return useQuery({
    queryKey: queryKeys.projectLoans(id),
    queryFn: () => projectsApi.loanAccounts(id),
  });
}

export function useProjectDisbursements(id: string) {
  return useQuery({
    queryKey: queryKeys.projectDisbursements(id),
    queryFn: () => projectsApi.disbursements(id),
  });
}

export function useProjectMilestones(id: string) {
  return useQuery({
    queryKey: queryKeys.projectMilestones(id),
    queryFn: () => projectsApi.milestones(id),
  });
}

export function useProjectRisks(id: string) {
  return useQuery({ queryKey: queryKeys.projectRisks(id), queryFn: () => projectsApi.risks(id) });
}

export function useLoanAccounts(filters: LoanFilters) {
  return useQuery({
    queryKey: queryKeys.loanList(filters),
    queryFn: () => loansApi.list(filters),
    placeholderData: keepPreviousData,
  });
}

export const PROJECT_STAGES: ProjectStage[] = ['feasibility', 'construction', 'operation'];

/**
 * Project counts per stage without fetching every project: one page_size=1
 * request per stage, reading meta.total_count.
 */
export function useStageCounts() {
  return useQueries({
    queries: PROJECT_STAGES.map((stage) => ({
      queryKey: queryKeys.projectList({ stage, page_size: 1 }),
      queryFn: () => projectsApi.list({ stage, page_size: 1 }),
    })),
    combine: (results) => ({
      counts: PROJECT_STAGES.map((stage, i) => ({
        stage,
        count: results[i]?.data?.meta.total_count ?? null,
      })),
      isLoading: results.some((r) => r.isLoading),
      error: results.find((r) => r.error)?.error ?? null,
    }),
  });
}

export function useGenerationPpa(id: string) {
  return useQuery({
    queryKey: queryKeys.projectTab(id, 'generation'),
    queryFn: () => projectsApi.generationPpa(id),
  });
}

export function useHydrology(id: string) {
  return useQuery({
    queryKey: queryKeys.projectTab(id, 'hydrology'),
    queryFn: () => projectsApi.hydrology(id),
  });
}

export function useLandGovernance(id: string) {
  return useQuery({
    queryKey: queryKeys.projectTab(id, 'land'),
    queryFn: () => projectsApi.landGovernance(id),
  });
}

export function useEsg(id: string) {
  return useQuery({
    queryKey: queryKeys.projectTab(id, 'esg'),
    queryFn: () => projectsApi.esg(id),
  });
}

export function useApprovalQueue(filters: ApprovalQueueFilters) {
  return useQuery({
    queryKey: queryKeys.approvalQueue(filters),
    queryFn: () => mutationsApi.queue(filters),
    placeholderData: keepPreviousData,
  });
}

export function useSubmitChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ChangeRequest) => mutationsApi.submit(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.approvals }),
  });
}

/** Approve (or recommend) / reject. A final approval changes the project or loan, so those refetch too. */
export function useDecideApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (decision: { id: string; verb: 'approve' | 'reject'; remarks: string }) =>
      decision.verb === 'approve'
        ? mutationsApi.approve(decision.id, decision.remarks)
        : mutationsApi.reject(decision.id, decision.remarks),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.approvals }),
        queryClient.invalidateQueries({ queryKey: queryKeys.projects }),
        queryClient.invalidateQueries({ queryKey: queryKeys.loans }),
      ]),
  });
}
