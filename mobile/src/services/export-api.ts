/**
 * Export API Service
 * API endpoints for export operations
 */

import { api } from './api';

export type ExportFormat = 'pdf' | 'excel' | 'json' | 'csv';

export interface ExportJob {
  id: string;
  name: string;
  features: string[];
  format: ExportFormat;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  fileSize?: number;
  url?: string;
  createdAt: string;
  completedAt?: string;
}

class ExportAPIService {
  private baseUrl = '/exports';

  async createExport(
    features: string[],
    format: ExportFormat,
    config?: any
  ): Promise<ExportJob> {
    try {
      const response = await api.post(`${this.baseUrl}`, {
        features,
        format,
        ...config,
      });
      return response.data;
    } catch (error) {
      console.error('Error creating export:', error);
      throw error;
    }
  }

  async listExports(limit: number = 50): Promise<ExportJob[]> {
    try {
      const response = await api.get(`${this.baseUrl}?limit=${limit}`);
      return response.data || [];
    } catch (error) {
      console.error('Error listing exports:', error);
      throw error;
    }
  }

  async getExport(exportId: string): Promise<ExportJob> {
    try {
      const response = await api.get(`${this.baseUrl}/${exportId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching export:', error);
      throw error;
    }
  }

  async getExportStatus(jobId: string): Promise<{ progress: number; status: string }> {
    try {
      const response = await api.get(`${this.baseUrl}/status/${jobId}`);
      return response.data;
    } catch (error) {
      console.error('Error checking export status:', error);
      throw error;
    }
  }

  async downloadExport(exportId: string): Promise<Blob> {
    try {
      const response = await api.get(`${this.baseUrl}/${exportId}/download`, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      console.error('Error downloading export:', error);
      throw error;
    }
  }

  async getDownloadUrl(exportId: string): Promise<string> {
    try {
      const response = await api.get(`${this.baseUrl}/${exportId}/url`);
      return response.data.url;
    } catch (error) {
      console.error('Error getting download URL:', error);
      throw error;
    }
  }

  async deleteExport(exportId: string): Promise<void> {
    try {
      await api.delete(`${this.baseUrl}/${exportId}`);
    } catch (error) {
      console.error('Error deleting export:', error);
      throw error;
    }
  }

  async shareExport(exportId: string, recipients: string[]): Promise<void> {
    try {
      await api.post(`${this.baseUrl}/${exportId}/share`, { recipients });
    } catch (error) {
      console.error('Error sharing export:', error);
      throw error;
    }
  }

  async pauseExport(jobId: string): Promise<void> {
    try {
      await api.post(`${this.baseUrl}/${jobId}/pause`, {});
    } catch (error) {
      console.error('Error pausing export:', error);
      throw error;
    }
  }

  async resumeExport(jobId: string): Promise<void> {
    try {
      await api.post(`${this.baseUrl}/${jobId}/resume`, {});
    } catch (error) {
      console.error('Error resuming export:', error);
      throw error;
    }
  }

  async cancelExport(jobId: string): Promise<void> {
    try {
      await api.post(`${this.baseUrl}/${jobId}/cancel`, {});
    } catch (error) {
      console.error('Error canceling export:', error);
      throw error;
    }
  }

  async retryExport(exportId: string): Promise<ExportJob> {
    try {
      const response = await api.post(`${this.baseUrl}/${exportId}/retry`, {});
      return response.data;
    } catch (error) {
      console.error('Error retrying export:', error);
      throw error;
    }
  }
}

export const exportAPI = new ExportAPIService();
