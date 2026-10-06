/**
 * Types mirroring the FastAPI schemas in backend/app/schemas. Pydantic v2
 * serializes Decimal fields as JSON strings, so money and capacity values
 * arrive as `DecimalString` and are parsed only for display.
 */
export type DecimalString = string;
export type IsoDate = string;

/** backend/app/schemas/common.py: ResponseMeta */
export interface ResponseMeta {
  timestamp: string;
  version: string;
  page: number | null;
  page_size: number | null;
  total_count: number | null;
}

/** backend/app/schemas/common.py: AuditMetadata */
export interface AuditMetadata {
  user_id: string;
  action: string;
  timestamp: string;
  request_id: string | null;
}

/** backend/app/schemas/common.py: ApiResponse[T] envelope */
export interface ApiResponse<T> {
  data: T;
  meta: ResponseMeta;
  audit: AuditMetadata;
}

export interface PageParams {
  page?: number;
  page_size?: number;
}

// --- Auth (backend/app/api/routes_auth.py) ---

export interface AuthUser {
  /** DB user UUID; also the JWT `sub` and the WebSocket routing key. */
  id: string;
  username: string;
  email: string | null;
  full_name: string | null;
  roles: string[];
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in_seconds: number;
  user: AuthUser;
  /** The user's role should have MFA but they have not enrolled yet. */
  mfa_enrollment_required?: boolean;
}

/** Password accepted, but a second factor is owed: finish with `authApi.loginMfa`. */
export interface MfaChallenge {
  mfa_required: true;
  mfa_token: string;
  expires_in_seconds: number;
  methods: string[];
}

export type LoginResponse = TokenResponse | MfaChallenge;

export function isMfaChallenge(response: LoginResponse): response is MfaChallenge {
  return 'mfa_required' in response && response.mfa_required === true;
}

export interface MfaStatus {
  is_enabled: boolean;
  primary_method: string | null;
  totp_enabled: boolean;
  backup_codes_available: number;
  mfa_required: boolean;
}

export interface MfaSetup {
  totp_uri: string;
  /** PNG, base64 */
  qr_code_base64: string;
}

// --- Projects (backend/app/schemas/project.py) ---

export type ProjectStage = 'feasibility' | 'construction' | 'operation';

export interface ProjectListItem {
  id: string;
  project_code: string;
  name_en: string;
  name_np: string;
  province: string | null;
  installed_capacity_mw: DecimalString;
  project_stage: string;
  pipeline_status: string;
  latest_cod_ad: IsoDate | null;
  latest_cod_bs: string | null;
  created_at: string;
  created_by: string;
}

export interface CodHistoryEntry {
  cod_type: string;
  date_ad: IsoDate | null;
  date_bs: string | null;
  version: number;
  revision_reason: string | null;
  source: string;
}

export interface ProjectDetail {
  id: string;
  project_code: string;
  name_en: string;
  name_np: string;
  location: { province: string | null; district: string | null; local_level: string | null };
  installed_capacity_mw: DecimalString;
  project_stage: string;
  pipeline_status: string;
  drop_reason: string | null;
  cod_history: CodHistoryEntry[];
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  loan_accounts_count: number;
  documents_count: number;
}

export interface ProjectFilters extends PageParams {
  status?: string;
  stage?: string;
  province?: string;
}

// --- Loan accounts (backend/app/schemas/loan.py) ---

export interface LoanAccountListItem {
  id: string;
  project_code: string;
  finacle_account_id: string;
  facility_type: string | null;
  sanctioned_amount: DecimalString;
  disbursed_amount: DecimalString;
  outstanding_principal: DecimalString;
  current_rate_pct: DecimalString | null;
  maturity_ad: IsoDate | null;
  sync_status: string;
  last_synced_at: string | null;
  created_at: string;
}

export interface LoanFilters extends PageParams {
  project_id?: string;
  status?: string;
  facility_type?: string;
}

export interface MilestoneItem {
  id: string;
  project_id: string;
  name: string;
  category: string | null;
  sequence: number;
  planned_date_ad: IsoDate;
  planned_date_bs: string | null;
  forecast_date_ad: IsoDate | null;
  actual_date_ad: IsoDate | null;
  status: 'planned' | 'in_progress' | 'completed' | 'delayed';
  percent_complete: DecimalString | null;
}

export interface RiskItem {
  id: string;
  project_id: string;
  title: string;
  risk_type: string;
  likelihood: number;
  impact: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  mitigation_status: 'open' | 'in_progress' | 'mitigated' | 'accepted';
  mitigation_owner: string | null;
  trigger_source: string | null;
}

export interface DisbursementTrancheItem {
  id: string;
  loan_account_id: string;
  facility_type: string | null;
  tranche_no: number | null;
  planned_amount: DecimalString | null;
  actual_amount: DecimalString | null;
  planned_date_ad: IsoDate | null;
  actual_date_ad: IsoDate | null;
}

export interface RepaymentItem {
  id: string;
  loan_account_id: string;
  facility_type: string | null;
  due_date_ad: IsoDate | null;
  principal_due: DecimalString;
  interest_due: DecimalString;
  principal_paid: DecimalString;
  interest_paid: DecimalString;
  paid_date_ad: IsoDate | null;
  days_past_due: number;
  status: 'paid' | 'overdue' | 'upcoming';
}

export interface ProjectDisbursements {
  tranches: DisbursementTrancheItem[];
  repayments: RepaymentItem[];
}

// --- Maker-checker (backend/app/api/routes_mutations.py) ---

export type ApprovalStateName = 'submitted' | 'recommended' | 'approved' | 'rejected';

/** One change request as listed by GET /api/v1/mutations/approval-queue. */
export interface ApprovalItem {
  id: string;
  entity_type: string;
  entity_id: string;
  /** Project or loan name; null for free-form request types. */
  entity_label: string | null;
  current_state: ApprovalStateName;
  maker_id: string;
  maker_name: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  action: string | null;
  justification: string | null;
  changes: Record<string, unknown> | null;
  previous_values: Record<string, unknown> | null;
  /** Whether the signed-in user may approve or reject this request now. */
  can_decide: boolean;
}

export interface ApprovalQueue {
  total: number;
  approvals: ApprovalItem[];
}

export interface ApprovalQueueFilters {
  status?: string;
  entity_type?: string;
}

export interface ChangeRequest {
  entity_type: 'PROJECT' | 'LOAN';
  entity_id: string;
  action: 'UPDATE';
  changes: Record<string, unknown>;
  justification: string;
}

export interface ChangeRequestResult {
  approval_request_id: string;
  current_state: ApprovalStateName;
}

export interface ApprovalDecisionResult {
  approval_request_id: string;
  new_state?: ApprovalStateName;
  state?: ApprovalStateName;
  changes_applied?: boolean;
}

// --- Project tabs (backend/app/api/routes_projects.py, Phase 10 endpoints) ---

export interface GenerationMonth {
  month: IsoDate | null;
  month_bs: string | null;
  season: string | null;
  contract_mwh: number | null;
  actual_mwh: number | null;
  /** A Decimal on the server, so it arrives as a string. */
  variance_pct: DecimalString | number | null;
  variance_status: string | null;
  availability_pct: number | null;
  curtailment_mwh: number;
  revenue_npr: number | null;
}

export interface GenerationPpaData {
  ppa: {
    agreement_number: string | null;
    purchaser: string | null;
    tariff_type: string | null;
    escalation_pct: number | null;
    status: string | null;
  } | null;
  monthly_data: GenerationMonth[];
  summary: {
    total_generated_mwh: number;
    total_contract_mwh: number;
    total_revenue_npr: number;
    avg_variance_pct: number;
    months_available: number;
  };
}

export interface WaterLicense {
  license_number: string | null;
  issuing_authority: string | null;
  river_basin: string | null;
  validity_from: IsoDate | null;
  validity_to: IsoDate | null;
  days_until_expiry: number | null;
  status: string;
}

export interface HydrologyData {
  hydrology: {
    river_basin?: string | null;
    sub_basin?: string | null;
    catchment_area_sqkm?: number | null;
    design_discharge_q90_m3s?: number | null;
    median_flow_q50_m3s?: number | null;
    measurement_date?: IsoDate | null;
    data_source?: string | null;
  };
  water_licenses: WaterLicense[];
  licenses_expiring_soon: number;
}

export interface LandGovernanceData {
  land_acquisition: {
    total_area_required_ropani: number;
    total_area_acquired_ropani: number;
    acquisition_pct: number;
    compensation_paid_npr: number;
    compensation_outstanding_npr: number;
    last_update?: IsoDate | null;
    remarks?: string | null;
  };
  board_of_directors: {
    total_members: number;
    members: { director_name: string; title: string | null; appointment_date: IsoDate | null }[];
  };
  shareholding: {
    total_shareholders: number;
    total_share_pct: number;
    shareholders: { entity_name: string; entity_type: string | null; share_pct: number }[];
  };
}

export interface EsgData {
  environmental: {
    carbon_credits_generated: number;
    ghg_emissions_avoided_tonnes: number;
    co2_avoided_tonnes_per_year: number;
  };
  social: {
    local_employment_count: number;
    community_grievance_count: number;
    grievance_resolution_rate_pct: number;
  };
  metrics_as_of: IsoDate | null;
  eia_mitigation: {
    total_measures: number;
    completed_measures: number;
    overall_completion_pct: number;
    measures: { id: string; measure: string; status: string | null; completion_pct: number }[];
  };
}

// --- CBS sync (backend/app/api/routes_cbs_sync.py) ---

export interface CbsDiffEntry {
  field: string;
  previous_value: string | number | null;
  new_value: string | number | null;
  status: 'changed' | 'same';
}

export interface CbsSyncResult {
  status: 'success' | 'error' | 'no_data';
  error?: string;
  sync_timestamp: string;
  changes_count: number;
  diff_log: CbsDiffEntry[];
  /** True when the backend has no Finacle connection and compared against its built-in sample record. */
  simulated: boolean;
  /** Whether the loan was updated with the fetched values. */
  applied: boolean;
}

// --- Loan exposure import (POST /api/v1/loan-accounts/exposure-sync) ---

/** One CSV row of backend/data/loan_exposure_import_template.csv, typed for the API. */
export interface ExposureImportItem {
  project_id: string;
  facility_type: string;
  sanctioned_amount: number;
  disbursed_amount?: number;
  outstanding_principal: number;
  outstanding_interest?: number;
  interest_rate_pct: number;
  tenor_years: number;
  grace_years: number;
  sanction_date: IsoDate;
  disbursement_date: IsoDate;
  maturity_date: IsoDate;
  risk_rating?: string;
  ifrs9_stage?: string;
  dscr?: number;
  ltv?: number;
  icr?: number;
}

export interface ExposureImportResult {
  sync_id: string;
  total_records: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  errors: string[];
  warnings: string[];
}

// --- WebSocket (backend/app/websocket/ws_handler.py, services/notification_service.py) ---

export type WsMessageType =
  'subscribe' | 'unsubscribe' | 'ack' | 'heartbeat' | 'event' | 'error' | 'reconnect';

export interface WsMessage<T = Record<string, unknown>> {
  type: WsMessageType;
  data: T;
  message_id: string | null;
  timestamp: string;
}

export type NotificationEventType =
  | 'export_completed'
  | 'export_failed'
  | 'approval_requested'
  | 'approval_completed'
  | 'rate_changed'
  | 'project_updated'
  | 'loan_updated'
  | 'user_logged_in'
  | 'user_logged_out'
  | 'system_alert';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

export interface NotificationEvent {
  id: string;
  type: NotificationEventType;
  user_id: string;
  data: Record<string, unknown>;
  priority: NotificationPriority;
  title: string | null;
  message: string | null;
  timestamp: string;
}
