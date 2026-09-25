import { api } from './api';
import type {
  ApiResponse,
  AuthUser,
  LoanAccountListItem,
  LoanFilters,
  LoginRequest,
  ProjectDetail,
  ProjectFilters,
  ProjectListItem,
  TokenResponse,
} from '@/types/api';

/** Drops empty filter values so they are not sent as `?status=`. */
function clean<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  ) as Partial<T>;
}

export const authApi = {
  login: (body: LoginRequest) =>
    api.post<TokenResponse>('/api/v1/auth/login', body).then((r) => r.data),
  logout: () => api.post('/api/v1/auth/logout'),
  /** Profile for the bearer token; a 401 here means the stored session is stale. */
  me: () => api.get<AuthUser>('/api/v1/auth/me').then((r) => r.data),
};

export const projectsApi = {
  list: (filters: ProjectFilters = {}) =>
    api
      .get<ApiResponse<ProjectListItem[]>>('/api/v1/projects', { params: clean(filters) })
      .then((r) => r.data),
  get: (id: string) =>
    api.get<ApiResponse<ProjectDetail>>(`/api/v1/projects/${id}`).then((r) => r.data),
  loanAccounts: (id: string) =>
    api
      .get<ApiResponse<LoanAccountListItem[]>>(`/api/v1/projects/${id}/loan-accounts`)
      .then((r) => r.data),
};

export const loansApi = {
  list: (filters: LoanFilters = {}) =>
    api
      .get<ApiResponse<LoanAccountListItem[]>>('/api/v1/loan-accounts', { params: clean(filters) })
      .then((r) => r.data),
};
