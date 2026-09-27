import { tableSchema, columnSchema } from '@nozbe/watermelondb';

/**
 * Inspection-related database schema for WatermelonDB
 * Supports offline-first inspection creation and synchronization
 */

export const inspectionSchema = tableSchema({
  name: 'inspections',
  columns: [
    columnSchema({
      name: 'project_id',
      type: 'string',
      isIndexed: true,
    }),
    columnSchema({
      name: 'project_name',
      type: 'string',
    }),
    columnSchema({
      name: 'title',
      type: 'string',
    }),
    columnSchema({
      name: 'description',
      type: 'string',
    }),
    columnSchema({
      name: 'type',
      type: 'string', // 'routine', 'safety', 'maintenance', 'compliance', 'emergency'
    }),
    columnSchema({
      name: 'status',
      type: 'string', // 'draft', 'submitted', 'approved', 'rejected'
      isIndexed: true,
    }),
    columnSchema({
      name: 'photo_count',
      type: 'number',
    }),
    columnSchema({
      name: 'checklist_data',
      type: 'string', // JSON stringified
    }),
    columnSchema({
      name: 'signature_data',
      type: 'string', // JSON stringified
    }),
    columnSchema({
      name: 'submitted_at',
      type: 'number',
      isIndexed: true,
    }),
    columnSchema({
      name: 'synced_at',
      type: 'number',
    }),
    columnSchema({
      name: 'created_at',
      type: 'number',
      isIndexed: true,
    }),
    columnSchema({
      name: 'updated_at',
      type: 'number',
    }),
  ],
});

export const inspectionPhotosSchema = tableSchema({
  name: 'inspection_photos',
  columns: [
    columnSchema({
      name: 'inspection_id',
      type: 'string',
      isIndexed: true,
    }),
    columnSchema({
      name: 'url',
      type: 'string',
    }),
    columnSchema({
      name: 'file_name',
      type: 'string',
    }),
    columnSchema({
      name: 'file_size',
      type: 'number',
    }),
    columnSchema({
      name: 'mime_type',
      type: 'string',
    }),
    columnSchema({
      name: 'notes',
      type: 'string',
    }),
    columnSchema({
      name: 'local_path',
      type: 'string', // For offline storage
    }),
    columnSchema({
      name: 'uploaded_at',
      type: 'number',
    }),
    columnSchema({
      name: 'synced',
      type: 'boolean',
    }),
    columnSchema({
      name: 'created_at',
      type: 'number',
    }),
  ],
});

export const inspectionDraftsSchema = tableSchema({
  name: 'inspection_drafts',
  columns: [
    columnSchema({
      name: 'project_id',
      type: 'string',
      isIndexed: true,
    }),
    columnSchema({
      name: 'project_name',
      type: 'string',
    }),
    columnSchema({
      name: 'title',
      type: 'string',
    }),
    columnSchema({
      name: 'description',
      type: 'string',
    }),
    columnSchema({
      name: 'type',
      type: 'string',
    }),
    columnSchema({
      name: 'status',
      type: 'string', // 'draft', 'pending_sync'
      isIndexed: true,
    }),
    columnSchema({
      name: 'data',
      type: 'string', // Full JSON stringified draft data
    }),
    columnSchema({
      name: 'photos_data',
      type: 'string', // JSON stringified photos
    }),
    columnSchema({
      name: 'saved_at',
      type: 'number',
      isIndexed: true,
    }),
    columnSchema({
      name: 'last_modified',
      type: 'number',
    }),
    columnSchema({
      name: 'synced_at',
      type: 'number',
    }),
  ],
});
