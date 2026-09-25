import type {
  ApiResponse,
  LoanAccountListItem,
  ProjectDetail,
  ProjectListItem,
  TokenResponse,
} from '@/types/api';

export function envelope<T>(data: T, meta: Partial<ApiResponse<T>['meta']> = {}): ApiResponse<T> {
  return {
    data,
    meta: {
      timestamp: '2026-09-24T00:00:00',
      version: '0.1.0',
      page: null,
      page_size: null,
      total_count: null,
      ...meta,
    },
    audit: {
      user_id: 'anonymous',
      action: 'read',
      timestamp: '2026-09-24T00:00:00',
      request_id: null,
    },
  };
}

export const tokenResponse: TokenResponse = {
  access_token: 'test-token',
  token_type: 'bearer',
  expires_in_seconds: 28_800,
  user: {
    id: '0b6f3c4e-2d1a-4e8b-9c7f-5a3d2e1f0a9b',
    username: 'ram.sharma',
    email: 'ram@sbl.local',
    full_name: 'Ram Sharma',
    roles: ['maker'],
  },
};

export function makeProject(overrides: Partial<ProjectListItem> = {}): ProjectListItem {
  return {
    id: 'p-1',
    project_code: 'SBL-HPP-0001',
    name_en: 'Upper Trishuli',
    name_np: 'माथिल्लो त्रिशूली',
    province: 'Bagmati',
    installed_capacity_mw: '216.0000',
    project_stage: 'construction',
    pipeline_status: 'approved',
    latest_cod_ad: '2027-07-15',
    latest_cod_bs: '2084-03-31',
    created_at: '2026-01-10T00:00:00',
    created_by: 'SYSTEM',
    ...overrides,
  };
}

export const projectDetail: ProjectDetail = {
  id: 'p-1',
  project_code: 'SBL-HPP-0001',
  name_en: 'Upper Trishuli',
  name_np: 'माथिल्लो त्रिशूली',
  location: { province: 'Bagmati', district: 'Rasuwa', local_level: 'Gosaikunda' },
  installed_capacity_mw: '216.0000',
  project_stage: 'construction',
  pipeline_status: 'approved',
  drop_reason: null,
  cod_history: [
    {
      cod_type: 'original_cod',
      date_ad: '2026-12-01',
      date_bs: '2083-08-16',
      version: 1,
      revision_reason: null,
      source: 'CBS_SYNCED',
    },
  ],
  created_at: '2026-01-10T00:00:00',
  updated_at: '2026-06-01T00:00:00',
  created_by: 'SYSTEM',
  updated_by: 'SYSTEM',
  loan_accounts_count: 1,
  documents_count: 4,
};

export function makeLoan(overrides: Partial<LoanAccountListItem> = {}): LoanAccountListItem {
  return {
    id: 'l-1',
    project_code: 'SBL-HPP-0001',
    finacle_account_id: '****1234',
    facility_type: 'term_loan',
    sanctioned_amount: '1500000000.00',
    disbursed_amount: '900000000.00',
    outstanding_principal: '850000000.00',
    current_rate_pct: '9.25',
    maturity_ad: '2040-01-01',
    sync_status: 'success',
    last_synced_at: '2026-09-20T10:00:00',
    created_at: '2026-01-10T00:00:00',
    ...overrides,
  };
}
