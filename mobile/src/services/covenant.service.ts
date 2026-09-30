/**
 * Covenant Service - API client for covenant compliance monitoring
 * Handles covenant data, breach tracking, and compliance scoring
 */

import axios from 'axios';
import { API_BASE_URL, API_TIMEOUT } from '@/config/api.config';

interface Covenant {
  id: string;
  projectId: string;
  name: string;
  category: 'financial' | 'operational' | 'environmental' | 'reporting' | 'maintenance';
  requirement: string;
  threshold: number;
  minAcceptable?: number;
  maxAcceptable?: number;
  warningThreshold: number;
  criticalThreshold: number;
  unit: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  status: 'compliant' | 'warning' | 'breached' | 'pending';
  currentValue: number;
  source: 'loan' | 'permit' | 'contract' | 'policy';
  startDate: string;
  endDate?: string;
  lastChecked: string;
  nextDue: string;
}

interface CovenantRecord {
  id: string;
  covenantId: string;
  date: string;
  value: number;
  status: 'compliant' | 'warning' | 'breached';
  recordedBy: string;
  notes?: string;
}

interface CovenantBreach {
  id: string;
  covenantId: string;
  startDate: string;
  endDate?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  status: 'active' | 'under_review' | 'cured' | 'waived';
  actions: BreachAction[];
}

interface BreachAction {
  id: string;
  breachId: string;
  description: string;
  dueDate: string;
  status: 'planned' | 'in_progress' | 'completed';
  assignee: string;
  completedDate?: string;
  notes?: string;
}

interface ComplianceScore {
  projectId: string;
  totalCovenants: number;
  compliantCount: number;
  warningCount: number;
  breachedCount: number;
  overallScore: number;
  trend: 'improving' | 'stable' | 'declining';
}

const API_ENDPOINTS = {
  covenants: '/covenants',
  covenant: (id: string) => `/covenants/${id}`,
  records: (id: string) => `/covenants/${id}/records`,
  breaches: '/covenants/breaches',
  breach: (id: string) => `/covenants/breaches/${id}`,
  actions: (breachId: string) => `/covenants/breaches/${breachId}/actions`,
  action: (breachId: string, actionId: string) => `/covenants/breaches/${breachId}/actions/${actionId}`,
  score: '/compliance/score',
  report: '/compliance/report',
  forecast: (id: string) => `/covenants/${id}/forecast`,
};

class CovenantService {
  private cachedData: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes

  /**
   * Get all covenants
   */
  async getCovenants(projectId?: string, filters?: any) {
    const cacheKey = `covenants-${projectId}-${JSON.stringify(filters || {})}`;
    if (this.isCacheValid(cacheKey)) {
      return this.cachedData.get(cacheKey)?.data;
    }

    try {
      const params: any = {};
      if (projectId) params.projectId = projectId;
      if (filters) Object.assign(params, filters);

      const response = await axios.get(`${API_BASE_URL}${API_ENDPOINTS.covenants}`, {
        params,
        timeout: API_TIMEOUT,
      });

      this.setCacheData(cacheKey, response.data);
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch covenants:', error);
      throw this.parseError(error);
    }
  }

  /**
   * Get single covenant
   */
  async getCovenant(covenantId: string) {
    const cacheKey = `covenant-${covenantId}`;
    if (this.isCacheValid(cacheKey)) {
      return this.cachedData.get(cacheKey)?.data;
    }

    try {
      const response = await axios.get(
        `${API_BASE_URL}${API_ENDPOINTS.covenant(covenantId)}`,
        { timeout: API_TIMEOUT }
      );

      this.setCacheData(cacheKey, response.data);
      return response.data;
    } catch (error: any) {
      console.error(`Failed to fetch covenant ${covenantId}:`, error);
      throw this.parseError(error);
    }
  }

  /**
   * Create covenant
   */
  async createCovenant(data: Partial<Covenant>) {
    try {
      const response = await axios.post(`${API_BASE_URL}${API_ENDPOINTS.covenants}`, data, {
        timeout: API_TIMEOUT,
      });

      this.invalidateCache('covenant');
      return response.data;
    } catch (error: any) {
      console.error('Failed to create covenant:', error);
      throw this.parseError(error);
    }
  }

  /**
   * Update covenant
   */
  async updateCovenant(covenantId: string, data: Partial<Covenant>) {
    try {
      const response = await axios.put(
        `${API_BASE_URL}${API_ENDPOINTS.covenant(covenantId)}`,
        data,
        { timeout: API_TIMEOUT }
      );

      this.invalidateCache(`covenant-${covenantId}`);
      return response.data;
    } catch (error: any) {
      console.error(`Failed to update covenant ${covenantId}:`, error);
      throw this.parseError(error);
    }
  }

  /**
   * Get covenant records (historical data)
   */
  async getCovenantRecords(covenantId: string, startDate?: string, endDate?: string) {
    const cacheKey = `records-${covenantId}-${startDate}-${endDate}`;
    if (this.isCacheValid(cacheKey)) {
      return this.cachedData.get(cacheKey)?.data;
    }

    try {
      const params: any = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await axios.get(
        `${API_BASE_URL}${API_ENDPOINTS.records(covenantId)}`,
        { params, timeout: API_TIMEOUT }
      );

      this.setCacheData(cacheKey, response.data);
      return response.data;
    } catch (error: any) {
      console.error(`Failed to fetch records for covenant ${covenantId}:`, error);
      throw this.parseError(error);
    }
  }

  /**
   * Record covenant value
   */
  async recordCovenantValue(covenantId: string, value: number, notes?: string) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}${API_ENDPOINTS.records(covenantId)}`,
        { value, notes, date: new Date().toISOString() },
        { timeout: API_TIMEOUT }
      );

      this.invalidateCache(`covenant-${covenantId}`);
      this.invalidateCache('compliance-score');
      return response.data;
    } catch (error: any) {
      console.error(`Failed to record covenant value for ${covenantId}:`, error);
      throw this.parseError(error);
    }
  }

  /**
   * Get breaches
   */
  async getBreaches(projectId?: string, status?: string) {
    const cacheKey = `breaches-${projectId}-${status || 'all'}`;
    if (this.isCacheValid(cacheKey)) {
      return this.cachedData.get(cacheKey)?.data;
    }

    try {
      const params: any = {};
      if (projectId) params.projectId = projectId;
      if (status) params.status = status;

      const response = await axios.get(`${API_BASE_URL}${API_ENDPOINTS.breaches}`, {
        params,
        timeout: API_TIMEOUT,
      });

      this.setCacheData(cacheKey, response.data);
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch breaches:', error);
      throw this.parseError(error);
    }
  }

  /**
   * Get breach details
   */
  async getBreach(breachId: string) {
    const cacheKey = `breach-${breachId}`;
    if (this.isCacheValid(cacheKey)) {
      return this.cachedData.get(cacheKey)?.data;
    }

    try {
      const response = await axios.get(`${API_BASE_URL}${API_ENDPOINTS.breach(breachId)}`, {
        timeout: API_TIMEOUT,
      });

      this.setCacheData(cacheKey, response.data);
      return response.data;
    } catch (error: any) {
      console.error(`Failed to fetch breach ${breachId}:`, error);
      throw this.parseError(error);
    }
  }

  /**
   * Create corrective action
   */
  async addBreachAction(breachId: string, actionData: Partial<BreachAction>) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}${API_ENDPOINTS.actions(breachId)}`,
        actionData,
        { timeout: API_TIMEOUT }
      );

      this.invalidateCache(`breach-${breachId}`);
      return response.data;
    } catch (error: any) {
      console.error(`Failed to add action to breach ${breachId}:`, error);
      throw this.parseError(error);
    }
  }

  /**
   * Update corrective action
   */
  async updateBreachAction(
    breachId: string,
    actionId: string,
    actionData: Partial<BreachAction>
  ) {
    try {
      const response = await axios.put(
        `${API_BASE_URL}${API_ENDPOINTS.action(breachId, actionId)}`,
        actionData,
        { timeout: API_TIMEOUT }
      );

      this.invalidateCache(`breach-${breachId}`);
      return response.data;
    } catch (error: any) {
      console.error(`Failed to update action ${actionId}:`, error);
      throw this.parseError(error);
    }
  }

  /**
   * Get compliance score
   */
  async getComplianceScore(projectId?: string) {
    const cacheKey = `compliance-score-${projectId || 'all'}`;
    if (this.isCacheValid(cacheKey)) {
      return this.cachedData.get(cacheKey)?.data;
    }

    try {
      const params: any = {};
      if (projectId) params.projectId = projectId;

      const response = await axios.get(`${API_BASE_URL}${API_ENDPOINTS.score}`, {
        params,
        timeout: API_TIMEOUT,
      });

      this.setCacheData(cacheKey, response.data);
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch compliance score:', error);
      throw this.parseError(error);
    }
  }

  /**
   * Generate compliance report
   */
  async generateReport(
    templateType: string,
    startDate: string,
    endDate: string,
    format: 'pdf' | 'excel' | 'csv' = 'pdf'
  ) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}${API_ENDPOINTS.report}`,
        { templateType, startDate, endDate, format },
        { timeout: 30000 }
      );

      return response.data;
    } catch (error: any) {
      console.error('Failed to generate report:', error);
      throw this.parseError(error);
    }
  }

  /**
   * Get forecast data for covenant
   */
  async getForecast(covenantId: string, months: number = 6) {
    const cacheKey = `forecast-${covenantId}-${months}`;
    if (this.isCacheValid(cacheKey)) {
      return this.cachedData.get(cacheKey)?.data;
    }

    try {
      const response = await axios.get(
        `${API_BASE_URL}${API_ENDPOINTS.forecast(covenantId)}`,
        { params: { months }, timeout: API_TIMEOUT }
      );

      this.setCacheData(cacheKey, response.data);
      return response.data;
    } catch (error: any) {
      console.error(`Failed to fetch forecast for covenant ${covenantId}:`, error);
      throw this.parseError(error);
    }
  }

  /**
   * Cache management
   */
  invalidateCache(pattern?: string) {
    if (pattern) {
      const keysToDelete = Array.from(this.cachedData.keys()).filter(key =>
        key.includes(pattern)
      );
      keysToDelete.forEach(key => this.cachedData.delete(key));
    } else {
      this.cachedData.clear();
    }
  }

  /**
   * Private helpers
   */
  private isCacheValid(key: string): boolean {
    const cached = this.cachedData.get(key);
    if (!cached) return false;

    const now = Date.now();
    return now - cached.timestamp < this.cacheExpiry;
  }

  private setCacheData(key: string, data: any) {
    this.cachedData.set(key, { data, timestamp: Date.now() });
  }

  private parseError(error: any): Error {
    if (error.response?.data?.message) {
      return new Error(error.response.data.message);
    }
    if (error.message) {
      return new Error(error.message);
    }
    return new Error('Failed to process covenant request');
  }
}

export const covenantService = new CovenantService();
