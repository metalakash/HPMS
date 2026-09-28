/**
 * Analytics Service - API client for analytics data
 * Handles portfolio metrics, project analytics, and forecasts
 */

import axios from 'axios';
import { API_BASE_URL, API_TIMEOUT } from '@/config/api.config';

interface AnalyticsMetric {
  id: string;
  metricType: 'production' | 'efficiency' | 'cost' | 'forecast';
  value: number;
  target?: number;
  timestamp: string;
  unit: string;
}

interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    borderColor?: string;
    backgroundColor?: string;
  }[];
}

interface AnalyticsReport {
  id: string;
  projectId: string;
  title: string;
  generatedAt: string;
  startDate: string;
  endDate: string;
  metrics: AnalyticsMetric[];
  charts: ChartData[];
}

interface ForecastData {
  timestamp: string;
  historical: number;
  forecast: number;
  lower: number;
  upper: number;
  confidence: number;
}

const API_ENDPOINTS = {
  portfolio: '/analytics/portfolio',
  project: (projectId: string) => `/analytics/project/${projectId}`,
  production: '/analytics/production',
  efficiency: '/analytics/efficiency',
  costs: '/analytics/costs',
  forecast: '/analytics/forecast',
  reports: '/analytics/reports',
  reportGenerate: '/analytics/reports/generate',
  reportExport: (id: string) => `/analytics/reports/${id}/export`,
};

class AnalyticsService {
  private cachedMetrics: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes

  /**
   * Get portfolio analytics overview
   */
  async getPortfolioAnalytics(period: '7d' | '30d' | '90d' | 'year' = '30d') {
    const cacheKey = `portfolio-${period}`;
    if (this.isCacheValid(cacheKey)) {
      return this.cachedMetrics.get(cacheKey)?.data;
    }

    try {
      const response = await axios.get(`${API_BASE_URL}${API_ENDPOINTS.portfolio}`, {
        params: { period },
        timeout: API_TIMEOUT,
      });

      this.setCacheMetrics(cacheKey, response.data);
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch portfolio analytics:', error);
      throw this.parseError(error);
    }
  }

  /**
   * Get project-specific analytics
   */
  async getProjectAnalytics(projectId: string, period: string = '30d') {
    const cacheKey = `project-${projectId}-${period}`;
    if (this.isCacheValid(cacheKey)) {
      return this.cachedMetrics.get(cacheKey)?.data;
    }

    try {
      const response = await axios.get(`${API_BASE_URL}${API_ENDPOINTS.project(projectId)}`, {
        params: { period },
        timeout: API_TIMEOUT,
      });

      this.setCacheMetrics(cacheKey, response.data);
      return response.data;
    } catch (error: any) {
      console.error(`Failed to fetch project ${projectId} analytics:`, error);
      throw this.parseError(error);
    }
  }

  /**
   * Get production metrics
   */
  async getProductionMetrics(startDate: string, endDate: string) {
    const cacheKey = `production-${startDate}-${endDate}`;
    if (this.isCacheValid(cacheKey)) {
      return this.cachedMetrics.get(cacheKey)?.data;
    }

    try {
      const response = await axios.get(`${API_BASE_URL}${API_ENDPOINTS.production}`, {
        params: { startDate, endDate },
        timeout: API_TIMEOUT,
      });

      this.setCacheMetrics(cacheKey, response.data);
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch production metrics:', error);
      throw this.parseError(error);
    }
  }

  /**
   * Get efficiency metrics
   */
  async getEfficiencyMetrics(startDate: string, endDate: string) {
    const cacheKey = `efficiency-${startDate}-${endDate}`;
    if (this.isCacheValid(cacheKey)) {
      return this.cachedMetrics.get(cacheKey)?.data;
    }

    try {
      const response = await axios.get(`${API_BASE_URL}${API_ENDPOINTS.efficiency}`, {
        params: { startDate, endDate },
        timeout: API_TIMEOUT,
      });

      this.setCacheMetrics(cacheKey, response.data);
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch efficiency metrics:', error);
      throw this.parseError(error);
    }
  }

  /**
   * Get cost analytics
   */
  async getCostAnalytics(startDate: string, endDate: string) {
    const cacheKey = `costs-${startDate}-${endDate}`;
    if (this.isCacheValid(cacheKey)) {
      return this.cachedMetrics.get(cacheKey)?.data;
    }

    try {
      const response = await axios.get(`${API_BASE_URL}${API_ENDPOINTS.costs}`, {
        params: { startDate, endDate },
        timeout: API_TIMEOUT,
      });

      this.setCacheMetrics(cacheKey, response.data);
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch cost analytics:', error);
      throw this.parseError(error);
    }
  }

  /**
   * Get forecast data
   */
  async getForecastData(metricType: 'production' | 'efficiency' | 'cost', months: number = 6) {
    const cacheKey = `forecast-${metricType}-${months}`;
    if (this.isCacheValid(cacheKey)) {
      return this.cachedMetrics.get(cacheKey)?.data;
    }

    try {
      const response = await axios.get(`${API_BASE_URL}${API_ENDPOINTS.forecast}`, {
        params: { metricType, months },
        timeout: API_TIMEOUT,
      });

      this.setCacheMetrics(cacheKey, response.data);
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch forecast data:', error);
      throw this.parseError(error);
    }
  }

  /**
   * Get anomaly alerts
   */
  async getAnomalyAlerts(projectId?: string) {
    try {
      const response = await axios.get(`${API_BASE_URL}${API_ENDPOINTS.portfolio}/anomalies`, {
        params: projectId ? { projectId } : {},
        timeout: API_TIMEOUT,
      });

      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch anomaly alerts:', error);
      throw this.parseError(error);
    }
  }

  /**
   * Generate report
   */
  async generateReport(
    templateType: string,
    format: 'pdf' | 'csv' | 'excel' | 'json',
    startDate: string,
    endDate: string
  ): Promise<AnalyticsReport> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}${API_ENDPOINTS.reportGenerate}`,
        {
          templateType,
          format,
          startDate,
          endDate,
        },
        { timeout: 30000 } // Longer timeout for report generation
      );

      return response.data;
    } catch (error: any) {
      console.error('Failed to generate report:', error);
      throw this.parseError(error);
    }
  }

  /**
   * Get generated reports
   */
  async getReports(limit: number = 20, offset: number = 0) {
    const cacheKey = `reports-${limit}-${offset}`;
    if (this.isCacheValid(cacheKey)) {
      return this.cachedMetrics.get(cacheKey)?.data;
    }

    try {
      const response = await axios.get(`${API_BASE_URL}${API_ENDPOINTS.reports}`, {
        params: { limit, offset },
        timeout: API_TIMEOUT,
      });

      this.setCacheMetrics(cacheKey, response.data);
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch reports:', error);
      throw this.parseError(error);
    }
  }

  /**
   * Export report in specific format
   */
  async exportReport(reportId: string, format: 'pdf' | 'csv' | 'excel' | 'json') {
    try {
      const response = await axios.get(`${API_BASE_URL}${API_ENDPOINTS.reportExport(reportId)}`, {
        params: { format },
        responseType: 'blob',
        timeout: 30000,
      });

      return response.data;
    } catch (error: any) {
      console.error('Failed to export report:', error);
      throw this.parseError(error);
    }
  }

  /**
   * Clear cache for specific key
   */
  invalidateCache(pattern?: string) {
    if (pattern) {
      const keysToDelete = Array.from(this.cachedMetrics.keys()).filter(key =>
        key.includes(pattern)
      );
      keysToDelete.forEach(key => this.cachedMetrics.delete(key));
    } else {
      this.cachedMetrics.clear();
    }
  }

  /**
   * Private helper methods
   */
  private isCacheValid(key: string): boolean {
    const cached = this.cachedMetrics.get(key);
    if (!cached) return false;

    const now = Date.now();
    return now - cached.timestamp < this.cacheExpiry;
  }

  private setCacheMetrics(key: string, data: any) {
    this.cachedMetrics.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  private parseError(error: any): Error {
    if (error.response?.data?.message) {
      return new Error(error.response.data.message);
    }
    if (error.message) {
      return new Error(error.message);
    }
    return new Error('Failed to fetch analytics data');
  }
}

export const analyticsService = new AnalyticsService();
