# HPMS Data Dictionary

> Generated from the SQLAlchemy models by `backend/scripts/generate_data_dictionary.py`. Do not edit by hand; run `python -m backend.scripts.generate_data_dictionary` and commit the result.

**70 tables and views, 1041 columns.** Dates are stored as AD `DATE` columns with a paired `*_bs` text column (`YYYY-MM-DD` Bikram Sambat) where the business needs both calendars. Descriptions come from the model docstrings.

## Contents

- **Projects**: `hydrology_records`, `land_records`, `project_capacity_history`, `project_technical_specs`, `projects`, `rcod_events`, `water_licenses`
- **Loans and financing**: `budget_lines`, `cbs_sync_logs`, `disbursement_tranches`, `loan_account_rate_history`, `loan_accounts`, `loan_exposure_sync_history`, `loan_exposure_sync_schedules`, `repayments`
- **Consortium**: `consortium_exposure_v`, `consortium_facilities`, `consortium_members`
- **Operations: PPA, hydrology, land, ESG, maintenance, covenants**: `board_of_directors`, `covenant_history`, `eia_mitigation_checklist`, `energy_generation_data`, `esg_metrics`, `hydrology_detailed`, `land_acquisition_tracking`, `maintenance_logs`, `maintenance_schedules`, `nea_ppa_rates`, `plant_performance`, `ppa_agreements`, `shareholding_hierarchy`, `tariff_structures`
- **Risk register, milestones, insurance, permits, ESIA, community**: `community_engagements`, `esia_monitoring_records`, `insurance_policies`, `milestones`, `project_permits`, `risk_register`
- **Regulatory filing calendar, reminders, stakeholder contacts**: `filing_calendar`, `regulatory_requirements`, `stakeholder_contacts`, `user_reminders`
- **Report builder**: `report_definitions`
- **Scheduled exports**: `export_job`, `export_job_run`
- **Users and access**: `project_owner`, `user`, `user_role_assignment`
- **Multi-factor authentication**: `backup_code`, `sms_verification`, `totp_verification`, `trusted_device`, `user_mfa`
- **Workflow and approvals**: `approval_requests`, `approval_steps`, `permissions`, `role_permissions`, `roles`, `workflow_definitions`
- **Audit trail**: `audit_log_reads`, `audit_logs`, `audit_retention_checkpoints`
- **Documents**: `document_approval_requests`, `document_versions`, `documents`
- **Import / ETL**: `airflow_loan_dag_runs`, `loan_data_provenance`, `loan_reconciliation_log`
- **Bulk import tracking**: `import_batches`, `import_row_errors`

## Projects

### `hydrology_records`

Hydrological data for environmental assessment.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `project_id` | UUID | no |  | FK → projects.id, indexed |
| `river_name` | VARCHAR(255) | yes |  |  |
| `river_basin` | VARCHAR(255) | yes |  |  |
| `sub_basin` | VARCHAR(255) | yes |  |  |
| `measurement_date_ad` | DATE | yes |  |  |
| `measurement_date_bs` | VARCHAR(10) | yes |  |  |
| `flow_cumecs` | NUMERIC(12, 4) | yes |  |  |
| `q40_design_flow` | NUMERIC(12, 4) | yes |  |  |
| `catchment_area_sqkm` | NUMERIC(12, 2) | yes |  |  |
| `source` | VARCHAR(100) | yes |  |  |
| `is_verified` | VARCHAR(50) | yes | `unverified` |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

### `land_records`

Land acquisition and ownership records.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `project_id` | UUID | no |  | FK → projects.id, indexed |
| `plot_id` | VARCHAR(100) | yes |  |  |
| `ownership_status` | VARCHAR(100) | yes |  |  |
| `acquisition_progress_pct` | NUMERIC(5, 2) | yes |  |  |
| `compensation_amount` | NUMERIC(20, 4) | yes |  |  |
| `compensation_status` | VARCHAR(100) | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

### `project_capacity_history`

Effective-dated capacity changes during design/construction phases.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `project_id` | UUID | no |  | FK → projects.id, indexed |
| `capacity_mw` | NUMERIC(12, 4) | no |  |  |
| `valid_from_ad` | DATE | no |  | indexed |
| `valid_from_bs` | VARCHAR(10) | yes |  |  |
| `valid_to_ad` | DATE | yes |  | indexed |
| `valid_to_bs` | VARCHAR(10) | yes |  |  |
| `is_current` | VARCHAR(5) | yes | `Y` | indexed |
| `revision_reason` | VARCHAR(255) | yes |  |  |
| `data_provenance` | VARCHAR(50) | yes | `DOCUMENT_VERIFIED` |  |
| `source_reference` | VARCHAR(255) | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: index `ix_capacity_current` (project_id, is_current); index `ix_capacity_validity` (valid_from_ad, valid_to_ad).

### `project_technical_specs`

Technical specifications for a project.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `project_id` | UUID | no |  | FK → projects.id, unique |
| `design_head_m` | NUMERIC(10, 2) | yes |  |  |
| `design_discharge_cumecs` | NUMERIC(12, 4) | yes |  |  |
| `plant_type` | VARCHAR(100) | yes |  |  |
| `turbine_type` | VARCHAR(100) | yes |  |  |
| `transmission_km` | NUMERIC(8, 2) | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

### `projects`

Core project master record.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `project_code` | VARCHAR(50) | no |  | unique, indexed |
| `name_en` | VARCHAR(255) | no |  |  |
| `name_np` | VARCHAR(255) | no |  |  |
| `province` | VARCHAR(100) | yes |  |  |
| `district` | VARCHAR(100) | yes |  |  |
| `local_level` | VARCHAR(100) | yes |  |  |
| `installed_capacity_mw` | NUMERIC(12, 4) | no |  |  |
| `project_stage` | VARCHAR(50) | no |  |  |
| `pipeline_status` | VARCHAR(50) | no |  | indexed |
| `original_cod_ad` | DATE | yes |  |  |
| `original_cod_bs` | VARCHAR(10) | yes |  |  |
| `current_approved_cod_ad` | DATE | yes |  |  |
| `current_approved_cod_bs` | VARCHAR(10) | yes |  |  |
| `forecast_cod_ad` | DATE | yes |  |  |
| `forecast_cod_bs` | VARCHAR(10) | yes |  |  |
| `actual_cod_ad` | DATE | yes |  |  |
| `actual_cod_bs` | VARCHAR(10) | yes |  |  |
| `drop_reason` | TEXT | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: unique index `ix_projects_project_code` (project_code).

### `rcod_events`

Revised Commercial Operation Date events with classification review triggers.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `project_id` | UUID | no |  | FK → projects.id, indexed |
| `rcod_ad` | DATE | no |  |  |
| `rcod_bs` | VARCHAR(10) | yes |  |  |
| `previous_rcod_ad` | DATE | yes |  |  |
| `previous_rcod_bs` | VARCHAR(10) | yes |  |  |
| `rcod_classification` | VARCHAR(100) | yes |  |  |
| `requires_classification_review` | VARCHAR(5) | yes | `Y` |  |
| `reason_for_revision` | TEXT | yes |  |  |
| `contract_amendment_reference` | VARCHAR(255) | yes |  |  |
| `data_provenance` | VARCHAR(50) | yes | `MANUAL_ENTRY` |  |
| `source_reference` | VARCHAR(255) | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: index `ix_rcod_classification` (rcod_classification, requires_classification_review); index `ix_rcod_dates` (rcod_ad, previous_rcod_ad).

### `water_licenses`

Water license and rights for the project.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `project_id` | UUID | no |  | FK → projects.id, indexed |
| `license_number` | VARCHAR(100) | yes |  | unique |
| `issuing_authority` | VARCHAR(255) | yes |  |  |
| `river_basin` | VARCHAR(255) | yes |  |  |
| `validity_from_ad` | DATE | yes |  |  |
| `validity_from_bs` | VARCHAR(10) | yes |  |  |
| `validity_to_ad` | DATE | yes |  |  |
| `validity_to_bs` | VARCHAR(10) | yes |  |  |
| `terms` | TEXT | yes |  |  |
| `status` | VARCHAR(50) | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

## Loans and financing

### `budget_lines`

Project budget and actual expense tracking.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `project_id` | UUID | no |  | FK → projects.id, indexed |
| `category` | VARCHAR(100) | yes |  |  |
| `budgeted_amount` | NUMERIC(20, 4) | yes |  |  |
| `actual_amount` | NUMERIC(20, 4) | yes | `0` |  |
| `variance_amount` | NUMERIC(20, 4) | yes |  |  |
| `variance_pct` | NUMERIC(7, 4) | yes |  |  |
| `upload_batch_id` | VARCHAR(255) | yes |  |  |
| `data_provenance` | VARCHAR(50) | yes | `MANUAL_ENTRY` |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

### `cbs_sync_logs`

Finacle CBS synchronisation audit log.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `loan_account_id` | UUID | yes |  | FK → loan_accounts.id, indexed |
| `sync_type` | VARCHAR(50) | no |  |  |
| `request_ref` | VARCHAR(255) | yes |  |  |
| `response_code` | VARCHAR(50) | yes |  |  |
| `started_at` | VARCHAR(100) | yes |  |  |
| `completed_at` | VARCHAR(100) | yes |  |  |
| `record_count` | INTEGER | yes | `0` |  |
| `raw_payload` | VARCHAR(10000) | yes |  |  |
| `error_detail` | TEXT | yes |  |  |
| `retry_count` | INTEGER | yes | `0` |  |
| `dlq_flag` | VARCHAR(50) | yes | `ok` | indexed |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

### `disbursement_tranches`

Disbursement tranche schedule and tracking.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `loan_account_id` | UUID | no |  | FK → loan_accounts.id, indexed |
| `tranche_no` | INTEGER | yes |  |  |
| `planned_amount` | NUMERIC(20, 4) | yes |  |  |
| `actual_amount` | NUMERIC(20, 4) | yes |  |  |
| `planned_date_ad` | DATE | yes |  |  |
| `planned_date_bs` | VARCHAR(10) | yes |  |  |
| `actual_date_ad` | DATE | yes |  |  |
| `actual_date_bs` | VARCHAR(10) | yes |  |  |
| `pro_rata_share_pct` | NUMERIC(9, 6) | yes |  |  |
| `data_provenance` | VARCHAR(50) | yes | `CBS_SYNCED` |  |
| `source_reference` | VARCHAR(255) | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

### `loan_account_rate_history`

Effective-dated interest rate history for loan accounts.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `loan_account_id` | UUID | no |  | FK → loan_accounts.id, indexed |
| `interest_rate_pct` | NUMERIC(7, 4) | no |  |  |
| `valid_from_ad` | DATE | no |  | indexed |
| `valid_from_bs` | VARCHAR(10) | yes |  |  |
| `valid_to_ad` | DATE | yes |  | indexed |
| `valid_to_bs` | VARCHAR(10) | yes |  |  |
| `is_current` | VARCHAR(5) | yes | `Y` | indexed |
| `reason_for_change` | VARCHAR(255) | yes |  |  |
| `data_provenance` | VARCHAR(50) | yes | `CBS_SYNCED` |  |
| `source_reference` | VARCHAR(255) | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: index `ix_rate_history_current` (loan_account_id, is_current); index `ix_rate_history_validity` (valid_from_ad, valid_to_ad).

### `loan_accounts`

Finacle loan account linked to a project.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `project_id` | UUID | no |  | FK → projects.id, indexed |
| `finacle_account_id` | VARCHAR(500) | no |  | unique |
| `facility_type` | VARCHAR(100) | yes |  |  |
| `sanctioned_amount` | NUMERIC(20, 4) | no |  |  |
| `disbursed_amount` | NUMERIC(20, 4) | yes | `0` |  |
| `outstanding_principal` | NUMERIC(20, 4) | yes | `0` |  |
| `outstanding_interest` | NUMERIC(20, 4) | yes | `0` |  |
| `overdue_principal` | NUMERIC(20, 4) | yes | `0` |  |
| `overdue_interest` | NUMERIC(20, 4) | yes | `0` |  |
| `currency_code` | VARCHAR(3) | yes | `NPR` |  |
| `fx_rate_to_npr` | NUMERIC(18, 8) | yes | `1` |  |
| `fx_rate_asof_ad` | DATE | yes |  |  |
| `interest_rate_pct` | NUMERIC(7, 4) | yes |  |  |
| `moratorium_end_ad` | DATE | yes |  |  |
| `moratorium_end_bs` | VARCHAR(10) | yes |  |  |
| `maturity_ad` | DATE | yes |  |  |
| `maturity_bs` | VARCHAR(10) | yes |  |  |
| `dscr` | NUMERIC(10, 4) | yes |  |  |
| `ltv` | NUMERIC(10, 4) | yes |  |  |
| `icr` | NUMERIC(10, 4) | yes |  |  |
| `metric_as_of_date` | DATE | yes |  |  |
| `last_synced_at` | VARCHAR(100) | yes |  |  |
| `sync_status` | VARCHAR(50) | yes | `pending` | indexed |
| `data_provenance` | VARCHAR(50) | yes | `MANUAL_ENTRY` |  |
| `source_reference` | VARCHAR(255) | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: index `ix_sync_status_synced` (sync_status, last_synced_at).

### `loan_exposure_sync_history`

History of loan exposure sync operations (Phase 8.3).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `schedule_id` | UUID | yes |  | FK → loan_exposure_sync_schedules.id, indexed |
| `sync_source` | VARCHAR(100) | no |  |  |
| `status` | VARCHAR(50) | no |  | indexed |
| `total_records` | INTEGER | yes | `0` |  |
| `created_count` | INTEGER | yes | `0` |  |
| `updated_count` | INTEGER | yes | `0` |  |
| `skipped_count` | INTEGER | yes | `0` |  |
| `error_message` | TEXT | yes |  |  |
| `alerts_triggered` | JSONB | yes |  |  |
| `started_at` | VARCHAR(100) | yes |  |  |
| `completed_at` | VARCHAR(100) | yes |  |  |
| `duration_seconds` | INTEGER | yes |  |  |
| `data_provenance` | VARCHAR(50) | yes | `AUTO_SYNC` |  |
| `source_reference` | VARCHAR(255) | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: index `ix_sync_history_status_date` (status, created_at).

### `loan_exposure_sync_schedules`

Scheduled automatic loan exposure sync (Phase 8.3 Option B).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `name` | VARCHAR(255) | no |  |  |
| `description` | TEXT | yes |  |  |
| `frequency` | VARCHAR(50) | no |  | indexed |
| `scheduled_time_utc` | VARCHAR(5) | yes |  |  |
| `day_of_week` | INTEGER | yes |  |  |
| `sync_source` | VARCHAR(100) | no |  |  |
| `source_config` | JSONB | yes |  |  |
| `is_active` | VARCHAR(1) | yes | `Y` | indexed |
| `last_sync_at` | VARCHAR(100) | yes |  |  |
| `last_sync_status` | VARCHAR(50) | yes |  |  |
| `last_sync_record_count` | INTEGER | yes | `0` |  |
| `last_sync_error` | TEXT | yes |  |  |
| `alert_on_dscr_below` | NUMERIC(10, 4) | yes |  |  |
| `alert_on_ltv_above` | NUMERIC(10, 4) | yes |  |  |
| `alert_on_concentration_above` | NUMERIC(10, 4) | yes |  |  |
| `alert_email_addresses` | VARCHAR(500) | yes |  |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |

Constraints and composite indexes: index `ix_sync_schedule_active` (is_active, frequency).

### `repayments`

Repayment schedule and tracking.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `loan_account_id` | UUID | no |  | FK → loan_accounts.id, indexed |
| `due_date_ad` | DATE | yes |  | indexed |
| `due_date_bs` | VARCHAR(10) | yes |  |  |
| `principal_due` | NUMERIC(20, 4) | yes |  |  |
| `interest_due` | NUMERIC(20, 4) | yes |  |  |
| `principal_paid` | NUMERIC(20, 4) | yes | `0` |  |
| `interest_paid` | NUMERIC(20, 4) | yes | `0` |  |
| `paid_date_ad` | DATE | yes |  |  |
| `paid_date_bs` | VARCHAR(10) | yes |  |  |
| `days_past_due` | INTEGER | yes | `0` |  |
| `data_provenance` | VARCHAR(50) | yes | `CBS_SYNCED` |  |
| `source_reference` | VARCHAR(255) | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

## Consortium

### `consortium_exposure_v`

Materialized view for consortium exposure (read-only reference). (Database view, read-only.)

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `project_id` | UUID | yes |  |  |
| `project_code` | VARCHAR(50) | yes |  |  |
| `facility_id` | UUID | yes |  |  |
| `institution_name` | VARCHAR(255) | yes |  |  |
| `sbl_role` | VARCHAR(50) | yes |  |  |
| `committed_amount` | NUMERIC(20, 4) | yes |  |  |
| `share_pct` | NUMERIC(9, 6) | yes |  |  |
| `disbursed_to_date` | NUMERIC(20, 4) | yes |  |  |
| `outstanding` | NUMERIC(20, 4) | yes |  |  |

### `consortium_facilities`

Consortium credit facility structure.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `project_id` | UUID | no |  | FK → projects.id, unique, indexed |
| `facility_name` | VARCHAR(255) | no |  |  |
| `total_facility_limit` | NUMERIC(20, 4) | no |  |  |
| `currency_code` | VARCHAR(3) | yes | `NPR` |  |
| `sbl_role` | VARCHAR(50) | no |  |  |
| `lead_bank_name` | VARCHAR(255) | yes |  |  |
| `facility_agreement_date_ad` | DATE | yes |  |  |
| `facility_agreement_date_bs` | VARCHAR(10) | yes |  |  |
| `security_type` | VARCHAR(100) | yes |  |  |
| `charge_ranking` | VARCHAR(50) | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: unique index `ix_consortium_facilities_project_id` (project_id).

### `consortium_members`

Consortium member with effective-dating for changes.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `consortium_facility_id` | UUID | no |  | FK → consortium_facilities.id, indexed |
| `institution_name` | VARCHAR(255) | no |  |  |
| `institution_type` | VARCHAR(100) | yes |  |  |
| `is_lead` | BOOLEAN | yes | `False` |  |
| `is_current` | BOOLEAN | yes | `True` | indexed |
| `committed_amount` | NUMERIC(20, 4) | no |  |  |
| `share_pct` | NUMERIC(9, 6) | no |  |  |
| `disbursed_to_date` | NUMERIC(20, 4) | yes | `0` |  |
| `valid_from_ad` | DATE | no |  |  |
| `valid_from_bs` | VARCHAR(10) | yes |  |  |
| `valid_to_ad` | DATE | yes |  |  |
| `valid_to_bs` | VARCHAR(10) | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: check `ck_share_pct_range`; index `ix_consortium_current` (consortium_facility_id, is_current); index `ix_consortium_effective` (valid_from_ad, valid_to_ad).

## Operations: PPA, hydrology, land, ESG, maintenance, covenants

### `board_of_directors`

Board of Directors composition.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `project_id` | UUID | no |  | FK → projects.id, indexed |
| `director_name` | VARCHAR(255) | no |  |  |
| `title` | VARCHAR(100) | yes |  |  |
| `appointment_date_ad` | DATE | yes |  |  |
| `appointment_date_bs` | VARCHAR(10) | yes |  |  |
| `resignation_date_ad` | DATE | yes |  |  |
| `resignation_date_bs` | VARCHAR(10) | yes |  |  |
| `is_current` | BOOLEAN | yes | `True` | indexed |
| `seon_reference` | VARCHAR(100) | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: index `ix_bod_project_current` (project_id, is_current).

### `covenant_history`

Quarterly covenant metric history for trend analysis.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `project_id` | UUID | no |  | FK → projects.id, indexed |
| `quarter_ad` | VARCHAR(10) | no |  |  |
| `quarter_bs` | VARCHAR(10) | yes |  |  |
| `covenant_date_ad` | DATE | yes |  |  |
| `covenant_date_bs` | VARCHAR(10) | yes |  |  |
| `dscr_value` | NUMERIC(10, 4) | yes |  |  |
| `dscr_threshold` | NUMERIC(10, 4) | yes |  |  |
| `dscr_status` | VARCHAR(50) | yes |  |  |
| `ltv_value` | NUMERIC(10, 4) | yes |  |  |
| `ltv_threshold` | NUMERIC(10, 4) | yes |  |  |
| `ltv_status` | VARCHAR(50) | yes |  |  |
| `icr_value` | NUMERIC(10, 4) | yes |  |  |
| `icr_threshold` | NUMERIC(10, 4) | yes |  |  |
| `icr_status` | VARCHAR(50) | yes |  |  |
| `calculation_date_ad` | DATE | yes |  |  |
| `data_provenance` | VARCHAR(50) | yes | `CALCULATED` |  |
| `source_reference` | VARCHAR(255) | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: unique (project_id, quarter_ad); index `ix_covenant_project_quarter` (project_id, quarter_ad).

### `eia_mitigation_checklist`

Environmental Impact Assessment mitigation measures tracking.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `project_id` | UUID | no |  | FK → projects.id, indexed |
| `mitigation_measure` | VARCHAR(500) | no |  |  |
| `description` | TEXT | yes |  |  |
| `status` | VARCHAR(50) | yes | `planned` | indexed |
| `completion_pct` | NUMERIC(5, 2) | yes | `0` |  |
| `responsible_party` | VARCHAR(255) | yes |  |  |
| `due_date_ad` | DATE | yes |  |  |
| `due_date_bs` | VARCHAR(10) | yes |  |  |
| `completion_date_ad` | DATE | yes |  |  |
| `completion_date_bs` | VARCHAR(10) | yes |  |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |

Constraints and composite indexes: index `ix_eia_project_status` (project_id, status).

### `energy_generation_data`

Monthly energy generation data with performance metrics.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `project_id` | UUID | no |  | FK → projects.id, indexed |
| `ppa_agreement_id` | UUID | yes |  | FK → ppa_agreements.id |
| `month_ad` | DATE | no |  |  |
| `month_bs` | VARCHAR(10) | yes |  |  |
| `season` | VARCHAR(20) | yes |  |  |
| `contract_energy_mwh` | NUMERIC(14, 2) | yes |  |  |
| `actual_energy_mwh` | NUMERIC(14, 2) | no |  |  |
| `availability_pct` | NUMERIC(5, 2) | yes |  |  |
| `curtailment_mwh` | NUMERIC(14, 2) | yes | `0` |  |
| `revenue_npr` | NUMERIC(18, 2) | yes |  |  |
| `data_provenance` | VARCHAR(50) | yes | `MANUAL_ENTRY` |  |
| `source_reference` | VARCHAR(255) | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: unique (project_id, month_ad); index `ix_generation_project_month` (project_id, month_ad); index `ix_generation_season` (project_id, season, month_ad).

### `esg_metrics`

Environmental, Social, Governance metrics.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `project_id` | UUID | no |  | FK → projects.id, indexed |
| `metric_date_ad` | DATE | no |  |  |
| `metric_date_bs` | VARCHAR(10) | yes |  |  |
| `carbon_credits_generated` | NUMERIC(14, 2) | yes | `0` |  |
| `ghg_emissions_avoided_tonnes` | NUMERIC(14, 2) | yes | `0` |  |
| `co2_avoided_tonnes_per_year` | NUMERIC(14, 2) | yes |  |  |
| `local_employment_count` | INTEGER | yes | `0` |  |
| `community_grievance_count` | INTEGER | yes | `0` |  |
| `grievance_resolution_rate_pct` | NUMERIC(5, 2) | yes |  |  |
| `data_provenance` | VARCHAR(50) | yes | `MANUAL_ENTRY` |  |
| `source_reference` | VARCHAR(255) | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: index `ix_esg_project_date` (project_id, metric_date_ad).

### `hydrology_detailed`

Extended hydrology data with flow curves and detailed basin info.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `project_id` | UUID | no |  | FK → projects.id, indexed |
| `river_basin` | VARCHAR(255) | no |  |  |
| `sub_basin` | VARCHAR(255) | yes |  |  |
| `catchment_area_sqkm` | NUMERIC(12, 2) | yes |  |  |
| `design_discharge_m3s` | NUMERIC(12, 4) | yes |  |  |
| `median_flow_m3s` | NUMERIC(12, 4) | yes |  |  |
| `flow_duration_curve_url` | VARCHAR(500) | yes |  |  |
| `measurement_date_ad` | DATE | yes |  |  |
| `measurement_date_bs` | VARCHAR(10) | yes |  |  |
| `data_provenance` | VARCHAR(50) | yes | `CONSULTANT_REPORT` |  |
| `source_reference` | VARCHAR(255) | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

### `land_acquisition_tracking`

Land acquisition progress and compensation tracking.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `project_id` | UUID | no |  | FK → projects.id, unique, indexed |
| `total_area_required_ropani` | NUMERIC(12, 2) | no |  |  |
| `total_area_acquired_ropani` | NUMERIC(12, 2) | yes | `0` |  |
| `acquisition_pct` | NUMERIC(5, 2) | yes | `0` |  |
| `compensation_paid_npr` | NUMERIC(20, 4) | yes | `0` |  |
| `compensation_outstanding_npr` | NUMERIC(20, 4) | yes | `0` |  |
| `last_update_date_ad` | DATE | yes |  |  |
| `last_update_date_bs` | VARCHAR(10) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |
| `remarks` | TEXT | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: unique index `ix_land_acquisition_tracking_project_id` (project_id).

### `maintenance_logs`

Executed maintenance activities and history.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `project_id` | UUID | no |  | FK → projects.id, indexed |
| `maintenance_schedule_id` | UUID | yes |  | FK → maintenance_schedules.id |
| `equipment_name` | VARCHAR(255) | no |  |  |
| `maintenance_type` | VARCHAR(100) | yes |  |  |
| `actual_date_ad` | DATE | no |  |  |
| `actual_date_bs` | VARCHAR(10) | yes |  |  |
| `duration_hours` | INTEGER | yes |  |  |
| `downtime_mwh` | NUMERIC(14, 2) | yes |  |  |
| `contractor_name` | VARCHAR(255) | yes |  |  |
| `cost_npr` | NUMERIC(18, 2) | yes | `0` |  |
| `notes` | TEXT | yes |  |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: index `ix_maint_log_project_date` (project_id, actual_date_ad).

### `maintenance_schedules`

Planned maintenance schedules.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `project_id` | UUID | no |  | FK → projects.id, indexed |
| `equipment_name` | VARCHAR(255) | no |  |  |
| `maintenance_type` | VARCHAR(100) | yes |  |  |
| `scheduled_date_ad` | DATE | no |  | indexed |
| `scheduled_date_bs` | VARCHAR(10) | yes |  |  |
| `estimated_duration_hours` | INTEGER | yes |  |  |
| `estimated_impact_mwh` | NUMERIC(14, 2) | yes |  |  |
| `contractor_name` | VARCHAR(255) | yes |  |  |
| `status` | VARCHAR(50) | yes | `scheduled` | indexed |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |

Constraints and composite indexes: index `ix_maint_sched_project_date` (project_id, scheduled_date_ad); index `ix_maint_sched_status` (project_id, status).

### `nea_ppa_rates`

NEA tariff rates for reference (used in revenue calculations).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `project_id` | UUID | no |  | FK → projects.id, indexed |
| `valid_from_ad` | DATE | no |  |  |
| `valid_from_bs` | VARCHAR(10) | yes |  |  |
| `valid_to_ad` | DATE | yes |  |  |
| `valid_to_bs` | VARCHAR(10) | yes |  |  |
| `season` | VARCHAR(20) | yes |  |  |
| `rate_per_mwh_npr` | NUMERIC(10, 4) | no |  |  |
| `fixed_charge_npr` | NUMERIC(18, 2) | yes | `0` |  |
| `variable_charge_pct` | NUMERIC(5, 4) | yes | `0` |  |
| `is_current` | BOOLEAN | yes | `True` | indexed |
| `data_provenance` | VARCHAR(50) | yes | `NEA_OFFICIAL` |  |
| `source_reference` | VARCHAR(255) | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: index `ix_nea_rates_project_current` (project_id, is_current); index `ix_nea_rates_validity` (valid_from_ad, valid_to_ad).

### `plant_performance`

Monthly plant performance metrics (availability, efficiency, PLF).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `project_id` | UUID | no |  | FK → projects.id, indexed |
| `month_ad` | DATE | no |  |  |
| `month_bs` | VARCHAR(10) | yes |  |  |
| `efficiency_pct` | NUMERIC(5, 2) | yes |  |  |
| `availability_pct` | NUMERIC(5, 2) | yes |  |  |
| `availability_hours` | INTEGER | yes |  |  |
| `outage_hours` | INTEGER | yes |  |  |
| `forced_outage_count` | INTEGER | yes | `0` |  |
| `forced_outage_hours` | INTEGER | yes | `0` |  |
| `scheduled_maintenance_outage_hours` | INTEGER | yes | `0` |  |
| `plf_pct` | NUMERIC(5, 2) | yes |  |  |
| `data_provenance` | VARCHAR(50) | yes | `SCADA` |  |
| `source_reference` | VARCHAR(255) | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: unique (project_id, month_ad); index `ix_perf_project_month` (project_id, month_ad).

### `ppa_agreements`

Power Purchase Agreement with NEA or private buyers.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `project_id` | UUID | no |  | FK → projects.id, indexed |
| `agreement_number` | VARCHAR(100) | no |  | unique |
| `purchaser` | VARCHAR(255) | no |  |  |
| `effective_date_ad` | DATE | no |  |  |
| `effective_date_bs` | VARCHAR(10) | yes |  |  |
| `expiry_date_ad` | DATE | yes |  |  |
| `expiry_date_bs` | VARCHAR(10) | yes |  |  |
| `tariff_type` | VARCHAR(50) | yes |  |  |
| `escalation_pct_annual` | NUMERIC(7, 4) | yes | `0` |  |
| `status` | VARCHAR(50) | yes | `active` | indexed |
| `renewal_date_ad` | DATE | yes |  |  |
| `renewal_date_bs` | VARCHAR(10) | yes |  |  |
| `data_provenance` | VARCHAR(50) | yes | `MANUAL_ENTRY` |  |
| `source_reference` | VARCHAR(255) | yes |  |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |

Constraints and composite indexes: index `ix_ppa_project_status` (project_id, status).

### `shareholding_hierarchy`

Shareholding structure and ownership hierarchy.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `project_id` | UUID | no |  | FK → projects.id, indexed |
| `entity_name` | VARCHAR(255) | no |  |  |
| `entity_type` | VARCHAR(100) | yes |  |  |
| `share_pct` | NUMERIC(7, 4) | no |  |  |
| `effective_from_ad` | DATE | no |  |  |
| `effective_from_bs` | VARCHAR(10) | yes |  |  |
| `effective_to_ad` | DATE | yes |  |  |
| `effective_to_bs` | VARCHAR(10) | yes |  |  |
| `is_current` | BOOLEAN | yes | `True` | indexed |
| `seon_reference` | VARCHAR(100) | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: index `ix_shareholding_project_current` (project_id, is_current).

### `tariff_structures`

Tariff structure configuration for revenue calculation.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `project_id` | UUID | no |  | FK → projects.id, indexed |
| `ppa_agreement_id` | UUID | yes |  | FK → ppa_agreements.id |
| `structure_type` | VARCHAR(50) | yes |  |  |
| `fixed_component_npr` | NUMERIC(18, 4) | yes | `0` |  |
| `variable_component_npr` | NUMERIC(10, 6) | yes | `0` |  |
| `escalation_formula` | TEXT | yes |  |  |
| `valid_from_ad` | DATE | yes |  |  |
| `valid_to_ad` | DATE | yes |  |  |
| `is_current` | BOOLEAN | yes | `True` | indexed |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: index `ix_tariff_project_current` (project_id, is_current).

## Risk register, milestones, insurance, permits, ESIA, community

### `community_engagements`

Community consultation or grievance with resolution tracking (RFP E.18).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `project_id` | UUID | no |  | FK → projects.id, indexed |
| `engagement_type` | VARCHAR(20) | no |  | indexed |
| `engagement_date_ad` | DATE | no |  |  |
| `engagement_date_bs` | VARCHAR(10) | yes |  |  |
| `stakeholder_group` | VARCHAR(255) | yes |  |  |
| `summary` | TEXT | no |  |  |
| `status` | VARCHAR(30) | yes | `open` | indexed |
| `resolution` | TEXT | yes |  |  |
| `resolved_date_ad` | DATE | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

### `esia_monitoring_records`

ESIA / EIA monitoring record (RFP E.17).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `project_id` | UUID | no |  | FK → projects.id, indexed |
| `monitoring_date_ad` | DATE | no |  |  |
| `monitoring_date_bs` | VARCHAR(10) | yes |  |  |
| `parameter` | VARCHAR(100) | no |  |  |
| `finding` | TEXT | yes |  |  |
| `compliance_status` | VARCHAR(30) | yes | `compliant` |  |
| `corrective_action` | TEXT | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

### `insurance_policies`

Project insurance policy with expiry tracking (RFP E.11, E.16).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `project_id` | UUID | no |  | FK → projects.id, indexed |
| `policy_number` | VARCHAR(100) | no |  | unique |
| `insurer` | VARCHAR(255) | no |  |  |
| `policy_type` | VARCHAR(50) | no |  |  |
| `sum_insured_npr` | NUMERIC(18, 2) | yes |  |  |
| `premium_npr` | NUMERIC(18, 2) | yes |  |  |
| `valid_from_ad` | DATE | no |  |  |
| `valid_from_bs` | VARCHAR(10) | yes |  |  |
| `valid_to_ad` | DATE | no |  |  |
| `valid_to_bs` | VARCHAR(10) | yes |  |  |
| `status` | VARCHAR(30) | yes | `active` | indexed |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

### `milestones`

Construction / financing milestone (RFP C.5, F.15). Feeds Gantt and slippage alerts.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `project_id` | UUID | no |  | FK → projects.id, indexed |
| `name` | VARCHAR(255) | no |  |  |
| `category` | VARCHAR(50) | yes |  |  |
| `sequence` | INTEGER | yes | `0` |  |
| `planned_date_ad` | DATE | no |  |  |
| `planned_date_bs` | VARCHAR(10) | yes |  |  |
| `forecast_date_ad` | DATE | yes |  |  |
| `forecast_date_bs` | VARCHAR(10) | yes |  |  |
| `actual_date_ad` | DATE | yes |  |  |
| `actual_date_bs` | VARCHAR(10) | yes |  |  |
| `status` | VARCHAR(30) | yes | `planned` | indexed |
| `percent_complete` | NUMERIC(5, 2) | yes | `0` |  |
| `remarks` | TEXT | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: index `ix_milestone_project_planned` (project_id, planned_date_ad).

### `project_permits`

Environmental / regulatory permit with validity (RFP E.2, E.16).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `project_id` | UUID | no |  | FK → projects.id, indexed |
| `permit_type` | VARCHAR(50) | no |  |  |
| `permit_number` | VARCHAR(100) | no |  |  |
| `issuing_authority` | VARCHAR(255) | yes |  |  |
| `valid_from_ad` | DATE | yes |  |  |
| `valid_to_ad` | DATE | yes |  | indexed |
| `valid_to_bs` | VARCHAR(10) | yes |  |  |
| `status` | VARCHAR(30) | yes | `active` | indexed |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

### `risk_register`

Project-specific risk with severity and mitigation tracking (RFP E.9, E.19, E.20).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `project_id` | UUID | no |  | FK → projects.id, indexed |
| `title` | VARCHAR(255) | no |  |  |
| `description` | TEXT | yes |  |  |
| `risk_type` | VARCHAR(30) | no |  | indexed |
| `likelihood` | INTEGER | no |  |  |
| `impact` | INTEGER | no |  |  |
| `severity` | VARCHAR(20) | no |  | indexed |
| `mitigation_action` | TEXT | yes |  |  |
| `mitigation_owner` | VARCHAR(255) | yes |  |  |
| `mitigation_due_ad` | DATE | yes |  |  |
| `mitigation_status` | VARCHAR(30) | yes | `open` | indexed |
| `trigger_source` | VARCHAR(50) | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

## Regulatory filing calendar, reminders, stakeholder contacts

### `filing_calendar`

One due filing: a requirement for a period, optionally for one project.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `requirement_id` | UUID | no |  | FK → regulatory_requirements.id, indexed |
| `project_id` | UUID | yes |  | FK → projects.id, indexed |
| `period_label` | VARCHAR(50) | no |  |  |
| `period_end_ad` | DATE | no |  |  |
| `period_end_bs` | VARCHAR(10) | yes |  |  |
| `due_date_ad` | DATE | no |  | indexed |
| `due_date_bs` | VARCHAR(10) | yes |  |  |
| `status` | VARCHAR(20) | no | `pending` | indexed |
| `filed_date_ad` | DATE | yes |  |  |
| `filed_date_bs` | VARCHAR(10) | yes |  |  |
| `reference_no` | VARCHAR(100) | yes |  |  |
| `assigned_to` | VARCHAR(255) | yes |  |  |
| `remarks` | TEXT | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: unique (requirement_id, project_id, period_end_ad); index `ix_filing_status_due` (status, due_date_ad).

### `regulatory_requirements`

A recurring (or one-off) filing owed to a regulator, e.g. a quarterly NRB return.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `code` | VARCHAR(50) | no |  | unique |
| `title` | VARCHAR(255) | no |  |  |
| `authority` | VARCHAR(20) | no |  | indexed |
| `description` | TEXT | yes |  |  |
| `legal_reference` | VARCHAR(255) | yes |  |  |
| `frequency` | VARCHAR(20) | no |  |  |
| `lag_days` | INTEGER | no | `0` |  |
| `applies_to` | VARCHAR(20) | no | `portfolio` |  |
| `is_active` | BOOLEAN | no | `True` | indexed |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

### `stakeholder_contacts`

Person or organisation that receives alerts, internal or external (RFP E.15, C.9).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `name` | VARCHAR(255) | no |  |  |
| `organization` | VARCHAR(255) | yes |  |  |
| `role` | VARCHAR(100) | yes |  |  |
| `category` | VARCHAR(30) | no | `external` | indexed |
| `email` | VARCHAR(255) | no |  |  |
| `phone` | VARCHAR(50) | yes |  |  |
| `project_id` | UUID | yes |  | FK → projects.id, indexed |
| `alert_types` | JSONB | yes |  |  |
| `min_urgency` | VARCHAR(20) | no | `critical` |  |
| `is_active` | BOOLEAN | no | `True` | indexed |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

### `user_reminders`

Personal reminder on a date, optionally tied to a project and an entity (RFP E.22).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `owner_username` | VARCHAR(255) | no |  | indexed |
| `title` | VARCHAR(255) | no |  |  |
| `note` | TEXT | yes |  |  |
| `remind_on_ad` | DATE | no |  | indexed |
| `remind_on_bs` | VARCHAR(10) | yes |  |  |
| `project_id` | UUID | yes |  | FK → projects.id, indexed |
| `entity_type` | VARCHAR(30) | yes |  |  |
| `entity_id` | VARCHAR(64) | yes |  |  |
| `status` | VARCHAR(20) | no | `active` | indexed |
| `sent_at` | DATE | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

## Report builder

### `report_definitions`

A named report: a source, the columns to show, and the filters to apply.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `name` | VARCHAR(255) | no |  |  |
| `description` | TEXT | yes |  |  |
| `source` | VARCHAR(50) | no |  | indexed |
| `columns` | JSONB | yes |  |  |
| `filters` | JSONB | yes |  |  |
| `sort_by` | VARCHAR(100) | yes |  |  |
| `sort_desc` | BOOLEAN | yes | `False` |  |
| `default_format` | VARCHAR(20) | yes | `excel` |  |
| `is_shared` | BOOLEAN | yes | `False` |  |
| `owner_username` | VARCHAR(255) | no |  | indexed |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

## Scheduled exports

### `export_job`

Scheduled export job configuration.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `report_id` | VARCHAR(100) | no |  | indexed |
| `export_format` | VARCHAR(50) | no |  |  |
| `schedule` | VARCHAR(100) | no |  |  |
| `name` | VARCHAR(255) | no |  |  |
| `recipients` | JSONB | no |  |  |
| `subject_template` | VARCHAR(255) | yes |  |  |
| `body_template` | TEXT | yes |  |  |
| `definition_id` | UUID | yes |  | FK → report_definitions.id, indexed |
| `filters` | JSONB | yes |  |  |
| `is_enabled` | BOOLEAN | yes | `True` | indexed |
| `last_run_at` | DATETIME | yes |  |  |
| `next_run_at` | DATETIME | yes |  |  |
| `max_retries` | VARCHAR(5) | yes | `3` |  |
| `retry_backoff_seconds` | VARCHAR(10) | yes | `300` |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: index `ix_job_report_schedule` (report_id, is_enabled).

### `export_job_run`

Historical record of export job execution.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `job_id` | UUID | no |  | FK → export_job.id, indexed |
| `status` | VARCHAR(50) | no |  | indexed |
| `started_at` | DATETIME | yes |  |  |
| `completed_at` | DATETIME | yes |  |  |
| `duration_seconds` | VARCHAR(10) | yes |  |  |
| `record_count` | VARCHAR(10) | yes |  |  |
| `file_url` | VARCHAR(1000) | yes |  |  |
| `file_size_bytes` | VARCHAR(20) | yes |  |  |
| `error_message` | TEXT | yes |  |  |
| `retry_count` | VARCHAR(5) | yes | `0` |  |
| `next_retry_at` | DATETIME | yes |  |  |
| `emails_sent` | VARCHAR(5) | yes | `N` |  |
| `email_send_time` | DATETIME | yes |  |  |
| `email_error` | TEXT | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: index `ix_run_next_retry` (job_id, next_retry_at); index `ix_run_status_date` (status, created_at).

## Users and access

### `project_owner`

Project ownership for row-level security.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `user_id` | UUID | no |  | FK → user.id, indexed |
| `project_id` | UUID | no |  | FK → projects.id, indexed |
| `ownership_type` | VARCHAR(50) | yes |  |  |
| `valid_from` | DATE | yes |  |  |
| `valid_to` | DATE | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: index `ix_owner_user_project` (user_id, project_id).

### `user`

User account linked to Active Directory.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `username` | VARCHAR(255) | no |  | unique, indexed |
| `email` | VARCHAR(255) | no |  | unique |
| `full_name` | VARCHAR(255) | yes |  |  |
| `ad_distinguished_name` | VARCHAR(1000) | yes |  |  |
| `is_active` | BOOLEAN | yes | `True` | indexed |
| `is_ad_synced` | BOOLEAN | yes | `False` |  |
| `last_login_at` | DATE | yes |  |  |
| `last_ad_sync_at` | DATE | yes |  |  |
| `default_role` | VARCHAR(50) | yes | `UserRole.GUEST` |  |
| `language_preference` | VARCHAR(10) | yes | `en` |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: unique index `ix_user_username` (username).

### `user_role_assignment`

User role assignments (many-to-many).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `user_id` | UUID | no |  | FK → user.id, indexed |
| `role` | VARCHAR(50) | no |  |  |
| `valid_from` | DATE | yes |  |  |
| `valid_to` | DATE | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: index `ix_role_user_role` (user_id, role).

## Multi-factor authentication

### `backup_code`

Backup codes for account recovery.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `user_mfa_id` | UUID | no |  | FK → user_mfa.id, indexed |
| `code` | VARCHAR(64) | no |  |  |
| `is_used` | BOOLEAN | yes | `False` |  |
| `used_at` | DATETIME | yes |  |  |
| `used_ip` | VARCHAR(45) | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: index `ix_backup_code_user` (user_mfa_id, is_used).

### `sms_verification`

SMS verification attempt history.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `user_mfa_id` | UUID | no |  | FK → user_mfa.id, indexed |
| `phone_number` | VARCHAR(20) | no |  |  |
| `code` | VARCHAR(6) | no |  |  |
| `success` | BOOLEAN | yes | `False` |  |
| `attempts` | VARCHAR(5) | yes | `0` |  |
| `sms_provider` | VARCHAR(50) | yes |  |  |
| `sms_id` | VARCHAR(255) | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: index `ix_sms_user_date` (user_mfa_id, created_at).

### `totp_verification`

TOTP verification attempt history.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `user_mfa_id` | UUID | no |  | FK → user_mfa.id, indexed |
| `code` | VARCHAR(6) | no |  |  |
| `success` | BOOLEAN | yes | `False` |  |
| `ip_address` | VARCHAR(45) | yes |  |  |
| `user_agent` | VARCHAR(500) | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: index `ix_totp_user_date` (user_mfa_id, created_at).

### `trusted_device`

Trusted device for skipping MFA.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `user_mfa_id` | UUID | no |  | FK → user_mfa.id, indexed |
| `device_name` | VARCHAR(255) | yes |  |  |
| `device_fingerprint` | VARCHAR(255) | no |  | unique |
| `browser` | VARCHAR(100) | yes |  |  |
| `os` | VARCHAR(100) | yes |  |  |
| `trusted_at` | DATETIME | no |  |  |
| `expires_at` | DATETIME | no |  |  |
| `is_active` | BOOLEAN | yes | `True` |  |
| `last_used_at` | DATETIME | yes |  |  |
| `last_ip` | VARCHAR(45) | yes |  |  |
| `use_count` | VARCHAR(10) | yes | `1` |  |
| `revoked_at` | DATETIME | yes |  |  |
| `revoke_reason` | VARCHAR(255) | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: index `ix_device_expires` (user_mfa_id, expires_at).

### `user_mfa`

User MFA configuration.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `user_id` | UUID | no |  | FK → user.id, unique, indexed |
| `is_mfa_enabled` | BOOLEAN | yes | `False` | indexed |
| `primary_method` | VARCHAR(50) | yes |  |  |
| `totp_secret` | VARCHAR(255) | yes |  |  |
| `totp_enabled` | BOOLEAN | yes | `False` |  |
| `totp_verified_at` | DATETIME | yes |  |  |
| `phone_number` | VARCHAR(20) | yes |  |  |
| `sms_enabled` | BOOLEAN | yes | `False` |  |
| `sms_verified_at` | DATETIME | yes |  |  |
| `email_enabled` | BOOLEAN | yes | `False` |  |
| `email_verified_at` | DATETIME | yes |  |  |
| `trusted_devices_enabled` | BOOLEAN | yes | `True` |  |
| `trust_duration_days` | VARCHAR(5) | yes | `30` |  |
| `backup_codes_generated_at` | DATETIME | yes |  |  |
| `backup_codes_regenerated_count` | VARCHAR(5) | yes | `0` |  |
| `mfa_required` | BOOLEAN | yes | `False` |  |
| `last_mfa_used_at` | DATETIME | yes |  |  |
| `failed_attempts` | VARCHAR(5) | yes | `0` |  |
| `locked_until` | DATETIME | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: unique index `ix_user_mfa_user_id` (user_id).

## Workflow and approvals

### `approval_requests`

Approval workflow instance.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `workflow_definition_id` | UUID | no |  | FK → workflow_definitions.id |
| `entity_type` | VARCHAR(100) | no |  |  |
| `entity_id` | VARCHAR(255) | no |  |  |
| `current_state` | VARCHAR(50) | no | `draft` | indexed |
| `maker_id` | VARCHAR(255) | no |  |  |
| `recommender_id` | VARCHAR(255) | yes |  |  |
| `approver_id` | VARCHAR(255) | yes |  |  |
| `submitted_at` | VARCHAR(100) | yes |  |  |
| `completed_at` | VARCHAR(100) | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: index `ix_entity_state` (entity_type, entity_id, current_state).

### `approval_steps`

Individual approval step in a workflow.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `approval_request_id` | UUID | no |  | FK → approval_requests.id, indexed |
| `step_no` | INTEGER | yes |  |  |
| `actor_id` | VARCHAR(255) | no |  |  |
| `actor_role` | VARCHAR(100) | yes |  |  |
| `from_state` | VARCHAR(50) | yes |  |  |
| `to_state` | VARCHAR(50) | no |  |  |
| `acted_at` | VARCHAR(100) | yes |  |  |
| `remarks` | TEXT | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

### `permissions`

Granular permissions (field-level, entity-level).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `entity_type` | VARCHAR(100) | no |  |  |
| `field_name` | VARCHAR(255) | yes |  |  |
| `access_level` | VARCHAR(50) | no |  |  |
| `description` | TEXT | yes |  |  |
| `is_active` | BOOLEAN | yes | `True` |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: unique (entity_type, field_name, access_level).

### `role_permissions`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `role_id` | UUID | no |  | PK, FK → roles.id |
| `permission_id` | UUID | no |  | PK, FK → permissions.id |

### `roles`

User roles in the system.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `name` | VARCHAR(100) | no |  | unique |
| `description` | TEXT | yes |  |  |
| `is_active` | BOOLEAN | yes | `True` |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

### `workflow_definitions`

Configurable workflow definition per use case.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `name` | VARCHAR(255) | no |  | unique |
| `entity_type` | VARCHAR(100) | no |  | indexed |
| `description` | TEXT | yes |  |  |
| `workflow_steps` | VARCHAR(10000) | yes |  |  |
| `is_active` | BOOLEAN | yes | `True` |  |
| `version` | INTEGER | yes | `1` |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

## Audit trail

### `audit_log_reads`

Track read access to sensitive data.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `user_id` | VARCHAR(255) | no |  | indexed |
| `timestamp` | VARCHAR(100) | no | `now()` | indexed |
| `entity_type` | VARCHAR(100) | no |  |  |
| `entity_id` | VARCHAR(255) | no |  |  |
| `export_format` | VARCHAR(50) | yes |  |  |
| `record_count` | INTEGER | yes |  |  |

Constraints and composite indexes: index `ix_read_user_timestamp` (user_id, timestamp).

### `audit_logs`

Append-only, immutable audit log with cryptographic chaining.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | BIGINT | no |  | PK |
| `user_id` | VARCHAR(255) | no |  | indexed |
| `user_role` | VARCHAR(100) | yes |  |  |
| `source_ip` | VARCHAR(50) | yes |  |  |
| `session_id` | VARCHAR(255) | yes |  |  |
| `timestamp` | VARCHAR(100) | no | `now()` | indexed |
| `entity_type` | VARCHAR(100) | no |  | indexed |
| `entity_id` | VARCHAR(255) | no |  | indexed |
| `action_performed` | VARCHAR(50) | no |  | indexed |
| `reason_for_action` | TEXT | no |  |  |
| `pre_state` | VARCHAR(10000) | yes |  |  |
| `post_state` | VARCHAR(10000) | yes |  |  |
| `state_hash` | VARCHAR(64) | no |  | unique |
| `prev_hash` | VARCHAR(64) | yes |  |  |

Constraints and composite indexes: check `ck_prev_hash_length`; check `ck_state_hash_length`; index `ix_entity_action` (entity_type, entity_id, action_performed); index `ix_user_action_timestamp` (user_id, action_performed, timestamp).

### `audit_retention_checkpoints`

Left behind by a retention purge so the remaining hash chain still verifies.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | INTEGER | no |  | PK |
| `purged_through_id` | BIGINT | no |  |  |
| `last_purged_hash` | VARCHAR(64) | no |  |  |
| `purged_count` | INTEGER | no |  |  |
| `retention_years` | INTEGER | no |  |  |
| `cutoff_date` | DATE | no |  |  |
| `purged_by` | VARCHAR(255) | no |  |  |
| `purged_at` | VARCHAR(100) | no | `now()` |  |

## Documents

### `document_approval_requests`

Optional approval workflow for documents.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `document_id` | UUID | no |  | FK → documents.id, indexed |
| `document_version_id` | UUID | no |  | FK → document_versions.id |
| `requested_by` | VARCHAR(255) | no |  |  |
| `request_date` | DATE | no |  |  |
| `approver_id` | VARCHAR(255) | yes |  |  |
| `approver_role` | VARCHAR(100) | yes |  |  |
| `approval_status` | VARCHAR(50) | yes | `pending` |  |
| `approval_date` | DATE | yes |  |  |
| `approval_remarks` | TEXT | yes |  |  |
| `reminder_count` | INTEGER | yes | `0` |  |
| `last_reminder_date` | DATE | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: index `ix_approval_status` (approval_status, approver_role).

### `document_versions`

Immutable version history of document files.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `document_id` | UUID | no |  | FK → documents.id, indexed |
| `version_number` | INTEGER | no |  |  |
| `is_current` | VARCHAR(5) | yes | `Y` | indexed |
| `file_name` | VARCHAR(255) | no |  |  |
| `file_size_bytes` | INTEGER | no |  |  |
| `file_hash` | VARCHAR(64) | no |  | unique |
| `mime_type` | VARCHAR(100) | yes |  |  |
| `storage_path` | VARCHAR(500) | no |  |  |
| `storage_backend` | VARCHAR(50) | yes | `local` |  |
| `content_encrypted` | VARCHAR(5) | yes | `N` |  |
| `content_checksum` | VARCHAR(64) | yes |  |  |
| `upload_comment` | TEXT | yes |  |  |
| `change_summary` | TEXT | yes |  |  |
| `source_reference` | VARCHAR(255) | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: check `ck_version_positive`; index `ix_document_current` (document_id, is_current); index `ix_version_date` (document_id, created_at).

### `documents`

Master document record with classification and lifecycle tracking.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `project_id` | UUID | no |  | FK → projects.id, indexed |
| `document_code` | VARCHAR(100) | no |  | unique, indexed |
| `title` | VARCHAR(255) | no |  |  |
| `description` | TEXT | yes |  |  |
| `classification` | VARCHAR(50) | no |  | indexed |
| `status` | VARCHAR(50) | no | `draft` | indexed |
| `document_date` | DATE | yes |  |  |
| `expiry_date` | DATE | yes |  |  |
| `requires_approval` | VARCHAR(5) | yes | `N` |  |
| `approved_by` | VARCHAR(255) | yes |  |  |
| `approval_date` | DATE | yes |  |  |
| `approval_remarks` | TEXT | yes |  |  |
| `file_count` | INTEGER | yes | `0` |  |
| `total_size_bytes` | INTEGER | yes | `0` |  |
| `source_reference` | VARCHAR(255) | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: check `ck_expiry_after_date`; unique index `ix_documents_document_code` (document_code); index `ix_project_classification` (project_id, classification); index `ix_status_date` (status, document_date).

## Import / ETL

### `airflow_loan_dag_runs`

Track Airflow DAG executions for loan sync.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `dag_id` | VARCHAR(255) | no |  | indexed |
| `run_id` | VARCHAR(255) | no |  |  |
| `status` | VARCHAR(50) | no |  | indexed |
| `start_time` | DATETIME | yes |  |  |
| `end_time` | DATETIME | yes |  |  |
| `duration_seconds` | INTEGER | yes |  |  |
| `total_extracted` | INTEGER | yes | `0` |  |
| `total_reconciled` | INTEGER | yes | `0` |  |
| `total_loaded` | INTEGER | yes | `0` |  |
| `reconciliation_conflicts` | INTEGER | yes | `0` |  |
| `error_message` | TEXT | yes |  |  |
| `created_at` | DATETIME | yes |  | indexed |
| `updated_at` | DATETIME | yes |  |  |

### `loan_data_provenance`

Track the source of each field in a loan account.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `loan_account_id` | UUID | no |  | FK → loan_accounts.id, indexed |
| `field_name` | VARCHAR(100) | no |  |  |
| `source` | VARCHAR(50) | no |  |  |
| `last_updated_at` | DATETIME | yes |  |  |
| `last_updated_by_dag_run_id` | UUID | yes |  | FK → airflow_loan_dag_runs.id |
| `created_at` | DATETIME | yes |  |  |

Constraints and composite indexes: index `idx_data_provenance_loan_field` (loan_account_id, field_name).

### `loan_reconciliation_log`

Track reconciliation decisions when merging multi-source loan data.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `loan_account_id` | UUID | no |  | FK → loan_accounts.id, indexed |
| `dag_run_id` | UUID | yes |  | FK → airflow_loan_dag_runs.id, indexed |
| `source_a` | VARCHAR(50) | no |  |  |
| `source_b` | VARCHAR(50) | yes |  |  |
| `conflict_type` | VARCHAR(100) | yes |  |  |
| `resolution` | VARCHAR(50) | yes |  |  |
| `resolved_by` | VARCHAR(100) | yes |  |  |
| `conflict_details` | JSONB | yes |  |  |
| `created_at` | DATETIME | yes |  |  |

Constraints and composite indexes: index `idx_reconciliation_log_loan_dag` (loan_account_id, dag_run_id).

## Bulk import tracking

### `import_batches`

Master record for bulk import operation.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `file_name` | VARCHAR(255) | no |  |  |
| `file_size_bytes` | INTEGER | yes |  |  |
| `mime_type` | VARCHAR(100) | yes |  |  |
| `import_type` | VARCHAR(50) | no |  | indexed |
| `status` | VARCHAR(50) | no | `pending` | indexed |
| `total_rows` | INTEGER | yes | `0` |  |
| `successful_rows` | INTEGER | yes | `0` |  |
| `failed_rows` | INTEGER | yes | `0` |  |
| `error_summary` | TEXT | yes |  |  |
| `uploaded_by` | VARCHAR(255) | no |  |  |
| `upload_timestamp` | DATE | no |  |  |
| `started_at` | DATE | yes |  |  |
| `completed_at` | DATE | yes |  |  |
| `processing_duration_seconds` | INTEGER | yes |  |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: index `ix_import_type_status` (import_type, status).

### `import_row_errors`

Line-by-line error log for import batch.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | no |  | PK |
| `batch_id` | UUID | no |  | FK → import_batches.id, indexed |
| `row_number` | INTEGER | no |  |  |
| `error_type` | VARCHAR(50) | yes |  |  |
| `column_name` | VARCHAR(255) | yes |  |  |
| `error_message` | VARCHAR(500) | no |  |  |
| `row_data_json` | VARCHAR(5000) | yes |  |  |
| `is_retryable` | VARCHAR(5) | yes | `Y` |  |
| `retry_count` | INTEGER | yes | `0` |  |
| `created_at` | DATETIME | yes | `now()` |  |
| `updated_at` | DATETIME | yes | `now()` |  |
| `created_by` | VARCHAR(255) | yes |  |  |
| `updated_by` | VARCHAR(255) | yes |  |  |

Constraints and composite indexes: index `ix_error_row` (batch_id, row_number).
