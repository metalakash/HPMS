/**
 * Report Service
 * High-level API for report operations
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { reportAPI, ReportRequest, GeneratedReport, ScheduledReport } from './report-api';
import { reportValidation, ValidationResult } from './report-validation.service';
import { reportGenerator, ReportData, ExportFormat } from './report-generator.service';

const CACHE_KEY = 'report_service_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export interface ReportCache {
  templates: { data: any; timestamp: number };
  reports: { data: any; timestamp: number };
  schedules: { data: any; timestamp: number };
}

class ReportService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private operationHistory: any[] = [];
  private readonly MAX_HISTORY = 50;

  async validateAndGenerateReport(request: ReportRequest, format: ExportFormat): Promise<GeneratedReport | null> {
    const validation = reportValidation.validateReportConfig(request);
    if (!validation.valid) {
      console.error('Report validation failed:', validation.errors);
      return null;
    }

    if (validation.warnings.length > 0) {
      console.warn('Report warnings:', validation.warnings);
    }

    try {
      const report = await reportAPI.generateReport(request, format);
      this.addToHistory('generate', { request, format });
      return report;
    } catch (error) {
      console.error('Error generating report:', error);
      return null;
    }
  }

  async getReportTemplates(category?: string, useCache = true): Promise<any[]> {
    const cacheKey = `templates_${category || 'all'}`;

    if (useCache && this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey)?.data || [];
    }

    try {
      const templates = await reportAPI.getReportTemplates(category);
      this.setCache(cacheKey, templates);
      return templates;
    } catch (error) {
      console.error('Error fetching templates:', error);
      return this.getCachedOrEmpty(cacheKey);
    }
  }

  async previewReport(request: ReportRequest): Promise<ReportData | null> {
    const validation = reportValidation.validateReportConfig(request);
    if (!validation.valid) {
      console.error('Preview validation failed:', validation.errors);
      return null;
    }

    try {
      return await reportAPI.previewReport(request);
    } catch (error) {
      console.error('Error previewing report:', error);
      return null;
    }
  }

  async exportReport(reportId: string, format: ExportFormat): Promise<string | null> {
    try {
      const { url } = await reportAPI.exportReport(reportId, format);
      this.addToHistory('export', { reportId, format });
      return url;
    } catch (error) {
      console.error('Error exporting report:', error);
      return null;
    }
  }

  async downloadReport(reportId: string): Promise<Blob | null> {
    try {
      return await reportAPI.downloadReport(reportId);
    } catch (error) {
      console.error('Error downloading report:', error);
      return null;
    }
  }

  async getGeneratedReports(useCache = true): Promise<GeneratedReport[]> {
    if (useCache && this.isCacheValid('reports')) {
      return this.cache.get('reports')?.data || [];
    }

    try {
      const reports = await reportAPI.getGeneratedReports();
      this.setCache('reports', reports);
      return reports;
    } catch (error) {
      console.error('Error fetching reports:', error);
      return this.getCachedOrEmpty('reports');
    }
  }

  async deleteReport(reportId: string): Promise<boolean> {
    try {
      await reportAPI.deleteReport(reportId);
      this.invalidateCache('reports');
      this.addToHistory('delete', { reportId });
      return true;
    } catch (error) {
      console.error('Error deleting report:', error);
      return false;
    }
  }

  async shareReport(reportId: string, teamMembers: string[]): Promise<boolean> {
    try {
      await reportAPI.shareReport(reportId, teamMembers);
      this.addToHistory('share', { reportId, teamMembers });
      return true;
    } catch (error) {
      console.error('Error sharing report:', error);
      return false;
    }
  }

  async scheduleReport(
    request: ReportRequest,
    frequency: 'daily' | 'weekly' | 'monthly',
    emailRecipients?: string[]
  ): Promise<ScheduledReport | null> {
    const validation = reportValidation.validateSchedule(frequency, emailRecipients);
    if (!validation.valid) {
      console.error('Schedule validation failed:', validation.errors);
      return null;
    }

    try {
      const schedule = await reportAPI.scheduleReport(request, frequency, emailRecipients);
      this.invalidateCache('schedules');
      this.addToHistory('schedule', { request, frequency });
      return schedule;
    } catch (error) {
      console.error('Error scheduling report:', error);
      return null;
    }
  }

  async getScheduledReports(useCache = true): Promise<ScheduledReport[]> {
    if (useCache && this.isCacheValid('schedules')) {
      return this.cache.get('schedules')?.data || [];
    }

    try {
      const schedules = await reportAPI.getScheduledReports();
      this.setCache('schedules', schedules);
      return schedules;
    } catch (error) {
      console.error('Error fetching schedules:', error);
      return this.getCachedOrEmpty('schedules');
    }
  }

  async updateSchedule(scheduleId: string, updates: Partial<ScheduledReport>): Promise<ScheduledReport | null> {
    try {
      const updated = await reportAPI.updateSchedule(scheduleId, updates);
      this.invalidateCache('schedules');
      this.addToHistory('updateSchedule', { scheduleId, updates });
      return updated;
    } catch (error) {
      console.error('Error updating schedule:', error);
      return null;
    }
  }

  async pauseSchedule(scheduleId: string): Promise<boolean> {
    try {
      await reportAPI.pauseSchedule(scheduleId);
      this.invalidateCache('schedules');
      this.addToHistory('pauseSchedule', { scheduleId });
      return true;
    } catch (error) {
      console.error('Error pausing schedule:', error);
      return false;
    }
  }

  async resumeSchedule(scheduleId: string): Promise<boolean> {
    try {
      await reportAPI.resumeSchedule(scheduleId);
      this.invalidateCache('schedules');
      this.addToHistory('resumeSchedule', { scheduleId });
      return true;
    } catch (error) {
      console.error('Error resuming schedule:', error);
      return false;
    }
  }

  async deleteSchedule(scheduleId: string): Promise<boolean> {
    try {
      await reportAPI.deleteSchedule(scheduleId);
      this.invalidateCache('schedules');
      this.addToHistory('deleteSchedule', { scheduleId });
      return true;
    } catch (error) {
      console.error('Error deleting schedule:', error);
      return false;
    }
  }

  // ==================== Cache Management ====================

  private isCacheValid(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;
    return Date.now() - cached.timestamp < CACHE_TTL;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private invalidateCache(key: string): void {
    this.cache.delete(key);
  }

  private getCachedOrEmpty(key: string): any {
    return this.cache.get(key)?.data || [];
  }

  // ==================== Operation History ====================

  private addToHistory(operation: string, details: any): void {
    this.operationHistory.unshift({
      operation,
      details,
      timestamp: new Date().toISOString(),
    });

    if (this.operationHistory.length > this.MAX_HISTORY) {
      this.operationHistory.pop();
    }

    this.saveHistory();
  }

  private async saveHistory(): Promise<void> {
    try {
      await AsyncStorage.setItem('report_operation_history', JSON.stringify(this.operationHistory));
    } catch (error) {
      console.error('Error saving operation history:', error);
    }
  }

  async getOperationHistory(): Promise<any[]> {
    try {
      const history = await AsyncStorage.getItem('report_operation_history');
      return history ? JSON.parse(history) : [];
    } catch (error) {
      console.error('Error loading operation history:', error);
      return [];
    }
  }

  async clearHistory(): Promise<void> {
    try {
      this.operationHistory = [];
      await AsyncStorage.removeItem('report_operation_history');
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  }
}

export const reportService = new ReportService();
