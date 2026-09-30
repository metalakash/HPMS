import { Database } from '@nozbe/watermelondb';
import { Inspection } from '../services/inspection.service';
import { OfflineInspectionItem } from '../services/inspection-offline-queue.service';

class InspectionDatabaseService {
  constructor(private db: Database) {}

  /**
   * Save inspection to local database
   */
  async saveInspection(inspection: Inspection): Promise<void> {
    try {
      const inspectionsCollection = this.db.get('inspections');
      await this.db.write(async () => {
        await inspectionsCollection.create((record: any) => {
          record.projectId = inspection.projectId;
          record.projectName = inspection.projectName;
          record.title = inspection.title;
          record.description = inspection.description;
          record.type = inspection.type;
          record.status = inspection.status;
          record.photoCount = inspection.photos.length;
          record.checklistData = JSON.stringify(inspection.checklist);
          record.signatureData = JSON.stringify(inspection.signature);
          record.submittedAt = inspection.submittedAt ? new Date(inspection.submittedAt).getTime() : null;
          record.createdAt = new Date(inspection.createdAt).getTime();
          record.updatedAt = new Date(inspection.updatedAt).getTime();
        });
      });
    } catch (error) {
      console.error('Failed to save inspection:', error);
      throw error;
    }
  }

  /**
   * Get inspection from local database
   */
  async getInspection(id: string): Promise<Inspection | null> {
    try {
      const inspectionsCollection = this.db.get('inspections');
      const record = await inspectionsCollection.find(id);
      return this.mapRecordToInspection(record);
    } catch (error) {
      console.error('Failed to get inspection:', error);
      return null;
    }
  }

  /**
   * Get all inspections from local database
   */
  async getAllInspections(): Promise<Inspection[]> {
    try {
      const inspectionsCollection = this.db.get('inspections');
      const records = await inspectionsCollection.query().fetch();
      return records.map((r) => this.mapRecordToInspection(r));
    } catch (error) {
      console.error('Failed to get inspections:', error);
      return [];
    }
  }

  /**
   * Save inspection draft to local database
   */
  async saveDraft(
    inspectionId: string,
    projectId: string,
    projectName: string,
    title: string,
    description: string,
    type: string,
    data: any
  ): Promise<void> {
    try {
      const draftsCollection = this.db.get('inspection_drafts');
      await this.db.write(async () => {
        await draftsCollection.create((record: any) => {
          record.inspectionId = inspectionId;
          record.projectId = projectId;
          record.projectName = projectName;
          record.title = title;
          record.description = description;
          record.type = type;
          record.status = 'draft';
          record.data = JSON.stringify(data);
          record.savedAt = Date.now();
          record.lastModified = Date.now();
        });
      });
    } catch (error) {
      console.error('Failed to save draft:', error);
      throw error;
    }
  }

  /**
   * Get draft from local database
   */
  async getDraft(inspectionId: string): Promise<any | null> {
    try {
      const draftsCollection = this.db.get('inspection_drafts');
      const records = await draftsCollection
        .query(
          (q) => q.where('inspection_id', inspectionId)
        )
        .fetch();

      if (records.length === 0) return null;
      const data = records[0].data;
      return typeof data === 'string' ? JSON.parse(data) : data;
    } catch (error) {
      console.error('Failed to get draft:', error);
      return null;
    }
  }

  /**
   * Delete draft from local database
   */
  async deleteDraft(inspectionId: string): Promise<void> {
    try {
      const draftsCollection = this.db.get('inspection_drafts');
      const records = await draftsCollection
        .query(
          (q) => q.where('inspection_id', inspectionId)
        )
        .fetch();

      await this.db.write(async () => {
        for (const record of records) {
          await record.destroyPermanently();
        }
      });
    } catch (error) {
      console.error('Failed to delete draft:', error);
      throw error;
    }
  }

  /**
   * Save inspection photo to local database
   */
  async savePhoto(
    inspectionId: string,
    photoId: string,
    url: string,
    fileName: string,
    fileSize: number,
    mimeType: string,
    localPath?: string
  ): Promise<void> {
    try {
      const photosCollection = this.db.get('inspection_photos');
      await this.db.write(async () => {
        await photosCollection.create((record: any) => {
          record.inspectionId = inspectionId;
          record.url = url;
          record.fileName = fileName;
          record.fileSize = fileSize;
          record.mimeType = mimeType;
          record.localPath = localPath || null;
          record.synced = !!url; // Synced if has URL
          record.uploadedAt = Date.now();
        });
      });
    } catch (error) {
      console.error('Failed to save photo:', error);
      throw error;
    }
  }

  /**
   * Get inspection photos from local database
   */
  async getInspectionPhotos(inspectionId: string): Promise<any[]> {
    try {
      const photosCollection = this.db.get('inspection_photos');
      const records = await photosCollection
        .query(
          (q) => q.where('inspection_id', inspectionId)
        )
        .fetch();

      return records.map((r) => ({
        id: r.id,
        inspectionId: r.inspectionId,
        url: r.url,
        fileName: r.fileName,
        fileSize: r.fileSize,
        mimeType: r.mimeType,
        localPath: r.localPath,
        synced: r.synced,
      }));
    } catch (error) {
      console.error('Failed to get photos:', error);
      return [];
    }
  }

  /**
   * Save offline inspection queue item
   */
  async saveOfflineInspection(item: OfflineInspectionItem): Promise<void> {
    // Implemented in main database service
    // This is a placeholder for the interface
  }

  /**
   * Get all offline inspection queue items
   */
  async getOfflineInspections(): Promise<OfflineInspectionItem[]> {
    // Implemented in main database service
    return [];
  }

  /**
   * Remove offline inspection queue item
   */
  async removeOfflineInspection(id: string): Promise<void> {
    // Implemented in main database service
  }

  /**
   * Clear all offline inspections
   */
  async clearOfflineInspections(): Promise<void> {
    // Implemented in main database service
  }

  /**
   * Mark inspection as sync failed
   */
  async markInspectionSyncFailed(id: string, error: string): Promise<void> {
    // Implemented in main database service
  }

  private mapRecordToInspection(record: any): Inspection {
    return {
      id: record.id,
      projectId: record.projectId,
      projectName: record.projectName,
      title: record.title,
      description: record.description,
      type: record.type,
      status: record.status,
      photos: [],
      checklist: JSON.parse(record.checklistData || '[]'),
      signature: JSON.parse(record.signatureData || '{}'),
      createdAt: new Date(record.createdAt).toISOString(),
      updatedAt: new Date(record.updatedAt).toISOString(),
      submittedAt: record.submittedAt
        ? new Date(record.submittedAt).toISOString()
        : undefined,
    };
  }
}

export const inspectionDatabaseService = (db: Database) =>
  new InspectionDatabaseService(db);
