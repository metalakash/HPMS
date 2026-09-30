/**
 * WatermelonDB Database Schema
 */

import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
  tables: [
    // Projects table
    tableSchema({
      name: 'projects',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'code', type: 'string' },
        { name: 'location', type: 'string' },
        { name: 'capacity_mw', type: 'number' },
        { name: 'stage', type: 'string' }, // feasibility, construction, operation
        { name: 'pipeline_status', type: 'string' }, // active, on-hold, completed
        { name: 'cod_date', type: 'number', isOptional: true }, // timestamp
        { name: 'province', type: 'string', isOptional: true },
        { name: 'district', type: 'string', isOptional: true },
        { name: 'last_updated', type: 'number' },
        { name: 'sync_status', type: 'string', isOptional: true }, // pending, synced, failed
      ],
    }),

    // Inspections table
    tableSchema({
      name: 'inspections',
      columns: [
        { name: 'project_id', type: 'string' },
        { name: 'inspection_date', type: 'number' },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'photos', type: 'string', isOptional: true }, // JSON array of photo URIs
        { name: 'signature', type: 'string', isOptional: true }, // base64
        { name: 'inspector_id', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'sync_status', type: 'string', isOptional: true }, // pending, synced, failed
      ],
    }),

    // Maintenance Works table
    tableSchema({
      name: 'maintenance_works',
      columns: [
        { name: 'project_id', type: 'string' },
        { name: 'equipment', type: 'string' },
        { name: 'work_type', type: 'string' }, // repair, inspection, replacement
        { name: 'status', type: 'string' }, // scheduled, in_progress, completed, overdue
        { name: 'scheduled_date', type: 'number' },
        { name: 'actual_date', type: 'number', isOptional: true },
        { name: 'estimated_duration', type: 'number' }, // hours
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'technician_id', type: 'string', isOptional: true },
        { name: 'parts', type: 'string', isOptional: true }, // JSON array
        { name: 'created_at', type: 'number' },
        { name: 'sync_status', type: 'string', isOptional: true },
      ],
    }),

    // Project Analytics table
    tableSchema({
      name: 'project_analytics',
      columns: [
        { name: 'project_id', type: 'string' },
        { name: 'date', type: 'number' }, // day timestamp
        { name: 'power_output_mw', type: 'number', isOptional: true },
        { name: 'anomaly_score', type: 'number', isOptional: true }, // 0-1
        { name: 'risk_level', type: 'string', isOptional: true }, // low, medium, high
        { name: 'metrics', type: 'string', isOptional: true }, // JSON object
        { name: 'last_updated', type: 'number' },
      ],
    }),

    // Documents table
    tableSchema({
      name: 'documents',
      columns: [
        { name: 'project_id', type: 'string' },
        { name: 'file_name', type: 'string' },
        { name: 'file_type', type: 'string' }, // pdf, image, etc
        { name: 'local_path', type: 'string', isOptional: true },
        { name: 'remote_url', type: 'string', isOptional: true },
        { name: 'uploaded_at', type: 'number', isOptional: true },
        { name: 'sync_status', type: 'string', isOptional: true },
      ],
    }),

    // Loan Accounts table
    tableSchema({
      name: 'loan_accounts',
      columns: [
        { name: 'project_id', type: 'string' },
        { name: 'facility_id', type: 'string' },
        { name: 'bank_name', type: 'string' },
        { name: 'sanctioned_amount', type: 'number' },
        { name: 'disbursed_amount', type: 'number' },
        { name: 'outstanding_amount', type: 'number' },
        { name: 'interest_rate', type: 'number' },
        { name: 'cbs_sync_status', type: 'string', isOptional: true },
        { name: 'last_synced', type: 'number', isOptional: true },
      ],
    }),
  ],
});
