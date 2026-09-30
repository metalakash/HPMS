/**
 * API Service - REST API client with axios, retry, and caching
 */

import axios, { AxiosInstance } from 'axios';
import useAppStore from '@/store/app.store';
import { cacheService } from './cache.service';
import { retry } from '@/utils/retry.util';
import {
  ApiError,
  parseApiError,
  isRetryableError,
  getErrorMessage,
} from '@/utils/api-error.util';
import * as endpoints from './endpoints';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

interface RequestOptions {
  cache?: boolean;
  cacheTTL?: number;
  retry?: boolean;
  maxRetries?: number;
}

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': 'en',
      },
    });

    // Request interceptor - add auth token
    this.client.interceptors.request.use((config) => {
      const token = useAppStore.getState().token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor - handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error: any) => {
        if (error.response?.status === 401) {
          useAppStore.getState().logout();
        }
        throw parseApiError(error);
      }
    );
  }

  /**
   * Make request with optional cache and retry
   */
  private async request<T>(
    method: string,
    url: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<T> {
    const {
      cache = true,
      cacheTTL = 5 * 60 * 1000,
      retry: shouldRetry = true,
      maxRetries = 3,
    } = options;

    // Try to get from cache (only for GET requests)
    if (method === 'GET' && cache) {
      const cached = await cacheService.get<T>(url);
      if (cached) {
        return cached;
      }
    }

    // Make request with retry
    const makeRequest = () =>
      this.client.request<T>({ method, url, data }).then(res => res.data);

    let result: T;

    if (shouldRetry && method === 'GET') {
      result = await retry(makeRequest, {
        maxRetries,
        shouldRetry: (error) => isRetryableError(error),
      });
    } else {
      result = await makeRequest();
    }

    // Cache successful GET responses
    if (method === 'GET' && cache) {
      await cacheService.set(url, result, cacheTTL);
    }

    return result;
  }

  // Portfolio Metrics
  async getPortfolioMetrics() {
    return this.request(
      'GET',
      endpoints.ANALYTICS_ENDPOINTS.portfolio,
      undefined,
      { cache: true, cacheTTL: 10 * 60 * 1000 } // 10 min cache
    );
  }

  // Projects
  async getProjects(page: number = 1, pageSize: number = 10) {
    const url = `${endpoints.PROJECTS_ENDPOINTS.list}?${new URLSearchParams(
      endpoints.queryParams.pagination(page, pageSize)
    ).toString()}`;
    return this.request('GET', url, undefined, {
      cache: true,
      cacheTTL: 5 * 60 * 1000,
    });
  }

  async getProjectById(projectId: string) {
    const url = endpoints.PROJECTS_ENDPOINTS.detail(projectId);
    return this.request('GET', url, undefined, {
      cache: true,
      cacheTTL: 10 * 60 * 1000,
    });
  }

  // Inspections
  async getInspections(projectId?: string) {
    const params = projectId ? { project_id: projectId } : {};
    const url = `${endpoints.INSPECTIONS_ENDPOINTS.list}?${new URLSearchParams(
      params
    ).toString()}`;
    return this.request('GET', url, undefined, { cache: true });
  }

  async createInspection(data: any) {
    // Clear cache after creation
    await cacheService.remove(endpoints.CACHE_KEYS.inspections());
    return this.request('POST', endpoints.INSPECTIONS_ENDPOINTS.create, data, {
      cache: false,
      retry: false,
    });
  }

  // Maintenance
  async getMaintenanceWorks(projectId?: string) {
    const params = projectId ? { project_id: projectId } : {};
    const url = `${endpoints.MAINTENANCE_ENDPOINTS.list}?${new URLSearchParams(
      params
    ).toString()}`;
    return this.request('GET', url, undefined, { cache: true });
  }

  async createMaintenanceWork(data: any) {
    await cacheService.remove(endpoints.CACHE_KEYS.maintenance());
    return this.request('POST', endpoints.MAINTENANCE_ENDPOINTS.create, data, {
      cache: false,
      retry: false,
    });
  }

  // Analytics
  async getProjectAnalytics(projectId: string) {
    const url = endpoints.ANALYTICS_ENDPOINTS.project(projectId);
    return this.request('GET', url, undefined, {
      cache: true,
      cacheTTL: 15 * 60 * 1000,
    });
  }

  // Loans
  async getLoanAccounts(projectId?: string) {
    const params = projectId ? { project_id: projectId } : {};
    const url = `${endpoints.LOANS_ENDPOINTS.list}?${new URLSearchParams(
      params
    ).toString()}`;
    return this.request('GET', url, undefined, { cache: true });
  }

  // Compliance
  async getCovenants(projectId: string) {
    const url = endpoints.COMPLIANCE_ENDPOINTS.covenants(projectId);
    return this.request('GET', url, undefined, {
      cache: true,
      cacheTTL: 10 * 60 * 1000,
    });
  }

  // Health check
  async healthCheck() {
    return this.request('GET', endpoints.HEALTH_ENDPOINTS.health, undefined, {
      cache: false,
      retry: true,
    });
  }

  /**
   * Invalidate cache
   */
  async invalidateCache(pattern?: string) {
    if (pattern) {
      // Would need more sophisticated cache invalidation
      // For now, clear specific keys
    } else {
      await cacheService.clear();
    }
  }
}

export const apiService = new ApiService();
