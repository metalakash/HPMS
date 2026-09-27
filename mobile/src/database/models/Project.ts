/**
 * Project Model - WatermelonDB
 */

import { Model } from '@nozbe/watermelondb';
import { field, readonly } from '@nozbe/watermelondb/decorators';

export default class Project extends Model {
  static table = 'projects';

  @field('name') name!: string;
  @field('code') code!: string;
  @field('location') location!: string;
  @field('capacity_mw') capacityMw!: number;
  @field('stage') stage!: string;
  @field('pipeline_status') pipelineStatus!: string;
  @field('cod_date') codDate?: number;
  @field('province') province?: string;
  @field('district') district?: string;
  @field('last_updated') lastUpdated!: number;
  @field('sync_status') syncStatus?: string;

  @readonly() @field('created_at') createdAt!: number;
  @readonly() @field('updated_at') updatedAt!: number;
}
