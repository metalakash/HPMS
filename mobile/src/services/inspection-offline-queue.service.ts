import { inspectionService, Inspection } from './inspection.service';
import useAppStore from '../store/app.store';
import { databaseService } from './database.service';

export interface OfflineInspectionItem {
  id: string;
  action: 'create' | 'update' | 'delete' | 'sync';
  inspectionId?: string;
  data: Partial<Inspection>;
  photos?: string[]; // Local photo URIs
  attempts: number;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
}

class InspectionOfflineQueueService {
  private syncInProgress = false;

  /**
   * Add inspection to offline queue
   */
  async addToQueue(
    action: 'create' | 'update' | 'delete',
    inspectionId: string | undefined,
    data: Partial<Inspection>,
    photos?: string[]
  ): Promise<void> {
    const store = useAppStore.getState();
    const item: OfflineInspectionItem = {
      id: `insp_${Date.now()}_${Math.random()}`,
      action,
      inspectionId,
      data,
      photos,
      attempts: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Save to local database
    await databaseService.saveOfflineInspection(item);

    // Also add to Zustand store for immediate reference
    store.addToQueue({
      action,
      entity: 'inspection',
      data: { ...item },
    });
  }

  /**
   * Process all queued inspections when online
   */
  async processQueue(): Promise<{
    successful: number;
    failed: number;
    errors: Map<string, string>;
  }> {
    if (this.syncInProgress) {
      console.log('Sync already in progress');
      return { successful: 0, failed: 0, errors: new Map() };
    }

    this.syncInProgress = true;
    const store = useAppStore.getState();
    const errors = new Map<string, string>();
    let successful = 0;
    let failed = 0;

    try {
      // Get all queued items from database
      const queuedItems = await databaseService.getOfflineInspections();

      for (const item of queuedItems) {
        try {
          await this.processQueueItem(item);
          successful++;

          // Remove from queue
          await databaseService.removeOfflineInspection(item.id);
          store.removeFromQueue(item.id);
        } catch (error) {
          failed++;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.set(item.id, errorMsg);

          // Update attempts
          item.attempts++;
          item.lastError = errorMsg;
          item.updatedAt = Date.now();

          // Don't retry if too many attempts
          if (item.attempts >= 5) {
            await databaseService.markInspectionSyncFailed(item.id, errorMsg);
            store.setSyncError(item.id, errorMsg);
          } else {
            // Update with new attempt count
            await databaseService.saveOfflineInspection(item);
          }
        }
      }

      // Update last sync time
      store.setLastSyncTime(Date.now());
    } finally {
      this.syncInProgress = false;
    }

    return { successful, failed, errors };
  }

  /**
   * Process a single queue item
   */
  private async processQueueItem(item: OfflineInspectionItem): Promise<void> {
    switch (item.action) {
      case 'create':
        await this.handleCreate(item);
        break;
      case 'update':
        await this.handleUpdate(item);
        break;
      case 'delete':
        await this.handleDelete(item);
        break;
      case 'sync':
        await this.handleSync(item);
        break;
    }
  }

  /**
   * Handle create action
   */
  private async handleCreate(item: OfflineInspectionItem): Promise<void> {
    const inspection = await inspectionService.createInspection(item.data);

    // Upload photos if any
    if (item.photos && item.photos.length > 0) {
      try {
        await inspectionService.uploadPhotos(inspection.id, item.photos as any);
      } catch (error) {
        console.error('Photo upload failed during sync:', error);
        // Don't fail the sync for photo issues
      }
    }
  }

  /**
   * Handle update action
   */
  private async handleUpdate(item: OfflineInspectionItem): Promise<void> {
    if (!item.inspectionId) {
      throw new Error('Inspection ID required for update');
    }

    await inspectionService.submitInspection(item.inspectionId, item.data as any);

    // Upload new photos if any
    if (item.photos && item.photos.length > 0) {
      try {
        await inspectionService.uploadPhotos(item.inspectionId, item.photos as any);
      } catch (error) {
        console.error('Photo upload failed during sync:', error);
      }
    }
  }

  /**
   * Handle delete action
   */
  private async handleDelete(item: OfflineInspectionItem): Promise<void> {
    if (!item.inspectionId) {
      throw new Error('Inspection ID required for delete');
    }

    // Delete inspection (API endpoint to be implemented)
    // await inspectionService.deleteInspection(item.inspectionId);
  }

  /**
   * Handle sync action (draft to inspection)
   */
  private async handleSync(item: OfflineInspectionItem): Promise<void> {
    if (!item.inspectionId) {
      throw new Error('Inspection ID required for sync');
    }

    await inspectionService.syncDraft(item.inspectionId);
  }

  /**
   * Get all queued inspections
   */
  async getQueuedInspections(): Promise<OfflineInspectionItem[]> {
    return databaseService.getOfflineInspections();
  }

  /**
   * Get queue status
   */
  async getQueueStatus(): Promise<{
    totalItems: number;
    pendingItems: number;
    failedItems: number;
  }> {
    const items = await databaseService.getOfflineInspections();
    const pendingItems = items.filter((i) => i.attempts < 5).length;
    const failedItems = items.filter((i) => i.attempts >= 5).length;

    return {
      totalItems: items.length,
      pendingItems,
      failedItems,
    };
  }

  /**
   * Clear all queued inspections (use with caution)
   */
  async clearQueue(): Promise<void> {
    const store = useAppStore.getState();
    await databaseService.clearOfflineInspections();
    store.clearQueue();
  }

  /**
   * Retry failed inspections
   */
  async retryFailed(): Promise<void> {
    const items = await databaseService.getOfflineInspections();
    const failedItems = items.filter((i) => i.attempts >= 5);

    for (const item of failedItems) {
      item.attempts = 0;
      item.lastError = undefined;
      item.updatedAt = Date.now();
      await databaseService.saveOfflineInspection(item);
    }

    // Process queue again
    await this.processQueue();
  }
}

export const inspectionOfflineQueueService = new InspectionOfflineQueueService();
