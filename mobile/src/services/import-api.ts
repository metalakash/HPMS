/**
 * Import API Service
 * API endpoints for import operations
 */

import { api } from './api';

export type ConflictStrategy = 'skip' | 'merge' | 'replace';

export interface ImportJob {
  id: string;
  fileName: string;
  feature: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  imported: number;
  skipped: number;
  conflicts: number;
  errors: number;
  createdAt: string;
  completedAt?: string;
}

export interface ImportConflict {
  recordId: string;
  field: string;
  newValue: any;
  existingValue: any;
}

class ImportAPIService {
  private baseUrl = '/imports';

  async uploadFile(
    file: File,
    feature: string,
    strategy: ConflictStrategy
  ): Promise<ImportJob> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('feature', feature);
      formData.append('strategy', strategy);

      const response = await api.post(`${this.baseUrl}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  async listImports(limit: number = 50): Promise<ImportJob[]> {
    try {
      const response = await api.get(`${this.baseUrl}?limit=${limit}`);
      return response.data || [];
    } catch (error) {
      console.error('Error listing imports:', error);
      throw error;
    }
  }

  async getImport(importId: string): Promise<ImportJob> {
    try {
      const response = await api.get(`${this.baseUrl}/${importId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching import:', error);
      throw error;
    }
  }

  async getImportStatus(jobId: string): Promise<{ progress: number; status: string }> {
    try {
      const response = await api.get(`${this.baseUrl}/status/${jobId}`);
      return response.data;
    } catch (error) {
      console.error('Error checking import status:', error);
      throw error;
    }
  }

  async getConflicts(importId: string): Promise<ImportConflict[]> {
    try {
      const response = await api.get(`${this.baseUrl}/${importId}/conflicts`);
      return response.data || [];
    } catch (error) {
      console.error('Error fetching conflicts:', error);
      throw error;
    }
  }

  async resolveConflicts(
    importId: string,
    strategy: ConflictStrategy,
    resolutions?: Record<string, any>
  ): Promise<void> {
    try {
      await api.post(`${this.baseUrl}/${importId}/resolve`, {
        strategy,
        resolutions,
      });
    } catch (error) {
      console.error('Error resolving conflicts:', error);
      throw error;
    }
  }

  async resolveConflict(
    importId: string,
    conflictId: string,
    resolution: 'keep' | 'replace',
    value?: any
  ): Promise<void> {
    try {
      await api.post(`${this.baseUrl}/${importId}/conflicts/${conflictId}/resolve`, {
        resolution,
        value,
      });
    } catch (error) {
      console.error('Error resolving conflict:', error);
      throw error;
    }
  }

  async pauseImport(jobId: string): Promise<void> {
    try {
      await api.post(`${this.baseUrl}/${jobId}/pause`, {});
    } catch (error) {
      console.error('Error pausing import:', error);
      throw error;
    }
  }

  async resumeImport(jobId: string): Promise<void> {
    try {
      await api.post(`${this.baseUrl}/${jobId}/resume`, {});
    } catch (error) {
      console.error('Error resuming import:', error);
      throw error;
    }
  }

  async cancelImport(jobId: string): Promise<void> {
    try {
      await api.post(`${this.baseUrl}/${jobId}/cancel`, {});
    } catch (error) {
      console.error('Error canceling import:', error);
      throw error;
    }
  }

  async retryImport(importId: string): Promise<ImportJob> {
    try {
      const response = await api.post(`${this.baseUrl}/${importId}/retry`, {});
      return response.data;
    } catch (error) {
      console.error('Error retrying import:', error);
      throw error;
    }
  }

  async validateFile(file: File, feature?: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (feature) {
        formData.append('feature', feature);
      }

      const response = await api.post(`${this.baseUrl}/validate`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      console.error('Error validating file:', error);
      return { valid: false, error: error instanceof Error ? error.message : 'Validation failed' };
    }
  }

  async previewFile(file: File): Promise<any[]> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post(`${this.baseUrl}/preview`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data || [];
    } catch (error) {
      console.error('Error previewing file:', error);
      throw error;
    }
  }
}

export const importAPI = new ImportAPIService();
