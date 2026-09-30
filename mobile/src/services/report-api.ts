/**
 * Report API Service
 * API endpoints for report operations
 */

import { api } from './api';

export type ExportFormat = 'pdf' | 'excel' | 'json' | 'csv';

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  feature: string;
  rating?: number;
  usageCount: number;
}

export interface ReportRequest {
  name: string;
  feature: string;
  fields: string[];
  dateRange?: { start: string; end: string };
  filters?: any[];
  groupBy?: string;
  sortBy?: string;
  includeStats: boolean;
  chartType?: string;
}

export interface GeneratedReport {
  id: string;
  name: string;
  format: ExportFormat;
  url: string;
  fileSize: number;
  generatedAt: string;
}

export interface ScheduledReport {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  nextRun: string;
  isActive: boolean;
}

class ReportAPIService {
  private baseUrl = '/reports';

  // ==================== Templates ====================

  async getReportTemplates(category?: string): Promise<ReportTemplate[]> {
    try {
      const url = category ? `${this.baseUrl}/templates?category=${category}` : `${this.baseUrl}/templates`;
      const response = await api.get(url);
      return response.data || [];
    } catch (error) {
      console.error('Error fetching report templates:', error);
      throw error;
    }
  }

  async getReportTemplate(templateId: string): Promise<ReportTemplate> {
    try {
      const response = await api.get(`${this.baseUrl}/templates/${templateId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching report template:', error);
      throw error;
    }
  }

  async rateTemplate(templateId: string, rating: number): Promise<void> {
    try {
      await api.post(`${this.baseUrl}/templates/${templateId}/rate`, { rating });
    } catch (error) {
      console.error('Error rating template:', error);
      throw error;
    }
  }

  // ==================== Report Generation ====================

  async generateReport(request: ReportRequest, format: ExportFormat): Promise<GeneratedReport> {
    try {
      const response = await api.post(`${this.baseUrl}/generate`, {
        ...request,
        format,
      });
      return response.data;
    } catch (error) {
      console.error('Error generating report:', error);
      throw error;
    }
  }

  async previewReport(request: ReportRequest): Promise<any> {
    try {
      const response = await api.post(`${this.baseUrl}/preview`, request);
      return response.data;
    } catch (error) {
      console.error('Error previewing report:', error);
      throw error;
    }
  }

  async exportReport(reportId: string, format: ExportFormat): Promise<{ url: string }> {
    try {
      const response = await api.get(`${this.baseUrl}/${reportId}/export/${format}`);
      return response.data;
    } catch (error) {
      console.error('Error exporting report:', error);
      throw error;
    }
  }

  async downloadReport(reportId: string): Promise<Blob> {
    try {
      const response = await api.get(`${this.baseUrl}/${reportId}/download`, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      console.error('Error downloading report:', error);
      throw error;
    }
  }

  // ==================== Report Management ====================

  async getGeneratedReports(limit: number = 50): Promise<GeneratedReport[]> {
    try {
      const response = await api.get(`${this.baseUrl}?limit=${limit}`);
      return response.data || [];
    } catch (error) {
      console.error('Error fetching generated reports:', error);
      throw error;
    }
  }

  async getReport(reportId: string): Promise<GeneratedReport> {
    try {
      const response = await api.get(`${this.baseUrl}/${reportId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching report:', error);
      throw error;
    }
  }

  async deleteReport(reportId: string): Promise<void> {
    try {
      await api.delete(`${this.baseUrl}/${reportId}`);
    } catch (error) {
      console.error('Error deleting report:', error);
      throw error;
    }
  }

  async shareReport(reportId: string, teamMembers: string[]): Promise<void> {
    try {
      await api.post(`${this.baseUrl}/${reportId}/share`, { teamMembers });
    } catch (error) {
      console.error('Error sharing report:', error);
      throw error;
    }
  }

  // ==================== Scheduled Reports ====================

  async scheduleReport(
    request: ReportRequest,
    frequency: 'daily' | 'weekly' | 'monthly',
    emailRecipients?: string[]
  ): Promise<ScheduledReport> {
    try {
      const response = await api.post(`${this.baseUrl}/schedules`, {
        ...request,
        frequency,
        emailRecipients,
      });
      return response.data;
    } catch (error) {
      console.error('Error scheduling report:', error);
      throw error;
    }
  }

  async getScheduledReports(): Promise<ScheduledReport[]> {
    try {
      const response = await api.get(`${this.baseUrl}/schedules`);
      return response.data || [];
    } catch (error) {
      console.error('Error fetching scheduled reports:', error);
      throw error;
    }
  }

  async updateSchedule(
    scheduleId: string,
    updates: Partial<ScheduledReport>
  ): Promise<ScheduledReport> {
    try {
      const response = await api.put(`${this.baseUrl}/schedules/${scheduleId}`, updates);
      return response.data;
    } catch (error) {
      console.error('Error updating schedule:', error);
      throw error;
    }
  }

  async pauseSchedule(scheduleId: string): Promise<void> {
    try {
      await api.post(`${this.baseUrl}/schedules/${scheduleId}/pause`, {});
    } catch (error) {
      console.error('Error pausing schedule:', error);
      throw error;
    }
  }

  async resumeSchedule(scheduleId: string): Promise<void> {
    try {
      await api.post(`${this.baseUrl}/schedules/${scheduleId}/resume`, {});
    } catch (error) {
      console.error('Error resuming schedule:', error);
      throw error;
    }
  }

  async deleteSchedule(scheduleId: string): Promise<void> {
    try {
      await api.delete(`${this.baseUrl}/schedules/${scheduleId}`);
    } catch (error) {
      console.error('Error deleting schedule:', error);
      throw error;
    }
  }
}

export const reportAPI = new ReportAPIService();
