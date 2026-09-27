/**
 * Inspection Model - WatermelonDB
 */

import { Model } from '@nozbe/watermelondb';
import { field, readonly } from '@nozbe/watermelondb/decorators';

export default class Inspection extends Model {
  static table = 'inspections';

  @field('project_id') projectId!: string;
  @field('inspection_date') inspectionDate!: number;
  @field('notes') notes?: string;
  @field('photos') photos?: string; // JSON array
  @field('signature') signature?: string;
  @field('inspector_id') inspectorId?: string;
  @field('sync_status') syncStatus?: string;

  @readonly() @field('created_at') createdAt!: number;
  @readonly() @field('updated_at') updatedAt!: number;
}
