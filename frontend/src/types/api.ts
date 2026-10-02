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
