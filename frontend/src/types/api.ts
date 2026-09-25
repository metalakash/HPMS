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
