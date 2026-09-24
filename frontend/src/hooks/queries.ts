import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import { loansApi, projectsApi } from '@/services/endpoints';
import type { LoanFilters, ProjectFilters, ProjectStage } from '@/types/api';

/** Central query keys so WebSocket events can invalidate by prefix. */
export const queryKeys = {
  projects: ['projects'] as const,
  projectList: (filters: ProjectFilters) => ['projects', 'list', filters] as const,
  project: (id: string) => ['projects', 'detail', id] as const,
  projectLoans: (id: string) => ['projects', 'detail', id, 'loans'] as const,
  loans: ['loans'] as const,
  loanList: (filters: LoanFilters) => ['loans', 'list', filters] as const,
};

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
