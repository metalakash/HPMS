import { api } from './api';
import type {
  ApiResponse,
  ApprovalDecisionResult,
  ApprovalQueue,
  ApprovalQueueFilters,
  CbsSyncResult,
  ChangeRequest,
  ChangeRequestResult,
  EsgData,
  ExposureImportItem,
  ExposureImportResult,
  GenerationPpaData,
  HydrologyData,
  LandGovernanceData,
  AuthUser,
  LoanAccountListItem,
  LoanFilters,
  LoginRequest,
  LoginResponse,
  MfaSetup,
  MfaStatus,
  MilestoneItem,
  ProjectDetail,
  ProjectDisbursements,
  ProjectFilters,
  ProjectListItem,
  RiskItem,
  TokenResponse,
} from '@/types/api';

/** Drops empty filter values so they are not sent as `?status=`. */
function clean<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  ) as Partial<T>;
}

export const authApi = {
  /** Either a session, or a challenge when the account has MFA on. */
  login: (body: LoginRequest) =>
    api.post<LoginResponse>('/api/v1/auth/login', body).then((r) => r.data),
  /** Second step: the challenge token plus an authenticator or backup code. */
  loginMfa: (body: { mfa_token: string; code: string }) =>
    api.post<TokenResponse>('/api/v1/auth/login/mfa', body).then((r) => r.data),
  logout: () => api.post('/api/v1/auth/logout'),
  /** Profile for the bearer token; a 401 here means the stored session is stale. */
  me: () => api.get<AuthUser>('/api/v1/auth/me').then((r) => r.data),
};

export const mfaApi = {
  status: () => api.get<MfaStatus>('/api/v1/mfa/status').then((r) => r.data),
  setup: () => api.post<MfaSetup>('/api/v1/mfa/setup').then((r) => r.data),
  verify: (code: string) =>
    api
      .post<{ success: boolean; message: string; mfa_verified: boolean }>('/api/v1/mfa/verify', {
        code,
      })
      .then((r) => r.data),
  backupCodes: () =>
    api.post<{ codes: string[]; message: string }>('/api/v1/mfa/backup-codes').then((r) => r.data),
  /** Needs a current authenticator code or an unused backup code. */
  disable: (code: string) => api.delete('/api/v1/mfa/disable', { data: { code } }),
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
  milestones: (id: string) =>
    api.get<ApiResponse<MilestoneItem[]>>(`/api/v1/projects/${id}/milestones`).then((r) => r.data),
  risks: (id: string) =>
    api.get<ApiResponse<RiskItem[]>>(`/api/v1/projects/${id}/risks`).then((r) => r.data),
  disbursements: (id: string) =>
    api
      .get<ApiResponse<ProjectDisbursements>>(`/api/v1/projects/${id}/disbursements`)
      .then((r) => r.data),
  generationPpa: (id: string) =>
    api
      .get<ApiResponse<GenerationPpaData>>(`/api/v1/projects/${id}/generation-ppa`)
      .then((r) => r.data.data),
  hydrology: (id: string) =>
    api
      .get<ApiResponse<HydrologyData>>(`/api/v1/projects/${id}/hydrology`)
      .then((r) => r.data.data),
  landGovernance: (id: string) =>
    api
      .get<ApiResponse<LandGovernanceData>>(`/api/v1/projects/${id}/land-governance`)
      .then((r) => r.data.data),
  esg: (id: string) =>
    api.get<ApiResponse<EsgData>>(`/api/v1/projects/${id}/esg`).then((r) => r.data.data),
};

/** Maker-checker change requests. */
export const mutationsApi = {
  queue: (filters: ApprovalQueueFilters = {}) =>
    api
      .get<ApiResponse<ApprovalQueue>>('/api/v1/mutations/approval-queue', {
        params: clean(filters),
      })
      .then((r) => r.data.data),
  submit: (body: ChangeRequest) =>
    api
      .post<ApiResponse<ChangeRequestResult>>('/api/v1/mutations/submit-with-justification', body)
      .then((r) => r.data.data),
  approve: (approvalRequestId: string, remarks?: string) =>
    api
      .post<ApiResponse<ApprovalDecisionResult>>('/api/v1/mutations/approve', {
        approval_request_id: approvalRequestId,
        remarks: remarks || undefined,
      })
      .then((r) => r.data.data),
  reject: (approvalRequestId: string, remarks: string) =>
    api
      .post<ApiResponse<ApprovalDecisionResult>>('/api/v1/mutations/reject', {
        approval_request_id: approvalRequestId,
        remarks,
      })
      .then((r) => r.data.data),
};

export const cbsApi = {
  /** `loanId` is the loan account's own id (the Finacle account number is masked in API responses). */
  sync: (projectId: string, loanId: string) =>
    api
      .post<ApiResponse<CbsSyncResult>>(`/api/v1/cbs/sync/${projectId}`, { loan_id: loanId })
      .then((r) => r.data.data),
};

export const loansApi = {
  list: (filters: LoanFilters = {}) =>
    api
      .get<ApiResponse<LoanAccountListItem[]>>('/api/v1/loan-accounts', { params: clean(filters) })
      .then((r) => r.data),
  /** Admin only. Creates or updates one loan account per row. */
  importExposures: (rows: ExposureImportItem[], sourceReference: string) =>
    api
      .post<ApiResponse<ExposureImportResult>>('/api/v1/loan-accounts/exposure-sync', {
        loan_accounts: rows,
        sync_source: 'CSV',
        source_reference: sourceReference,
      })
      .then((r) => r.data.data),
};
