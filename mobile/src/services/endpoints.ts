/**
 * API Endpoints - Centralized endpoint definitions
 */

// Auth
export const AUTH_ENDPOINTS = {
  login: '/auth/login',
  logout: '/auth/logout',
  refresh: '/auth/refresh',
  me: '/auth/me',
};

// Projects
export const PROJECTS_ENDPOINTS = {
  list: '/projects',
  detail: (id: string) => `/projects/${id}`,
  loanAccounts: (id: string) => `/projects/${id}/loans`,
};

// Inspections
export const INSPECTIONS_ENDPOINTS = {
  list: '/inspections',
  create: '/inspections',
  detail: (id: string) => `/inspections/${id}`,
  update: (id: string) => `/inspections/${id}`,
};

// Maintenance
export const MAINTENANCE_ENDPOINTS = {
  list: '/maintenance/schedule',
  create: '/maintenance/work-orders',
  detail: (id: string) => `/maintenance/work-orders/${id}`,
  update: (id: string) => `/maintenance/work-orders/${id}`,
};

// Analytics
export const ANALYTICS_ENDPOINTS = {
  portfolio: '/analytics/portfolio',
  project: (id: string) => `/analytics/project/${id}`,
  forecast: (id: string) => `/analytics/project/${id}/forecast`,
  anomalies: (id: string) => `/analytics/project/${id}/anomalies`,
};

// Loans
export const LOANS_ENDPOINTS = {
  list: '/loans',
  detail: (id: string) => `/loans/${id}`,
  accounts: (projectId: string) => `/loans?project_id=${projectId}`,
};

// Compliance
export const COMPLIANCE_ENDPOINTS = {
  covenants: (projectId: string) => `/compliance/covenants?project_id=${projectId}`,
  alerts: '/compliance/alerts',
  auditTrail: (projectId: string) => `/compliance/audit-trail?project_id=${projectId}`,
};

// Health
export const HEALTH_ENDPOINTS = {
  health: '/health',
  ready: '/ready',
};

/**
 * Query parameters builders
 */
export const queryParams = {
  pagination: (page: number = 1, pageSize: number = 10) => ({
    page,
    page_size: pageSize,
  }),

  filter: (filters: Record<string, any>) => {
    const params: Record<string, any> = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params[key] = value;
      }
    });
    return params;
  },

  dateRange: (startDate: number, endDate: number) => ({
    start_date: new Date(startDate).toISOString(),
    end_date: new Date(endDate).toISOString(),
  }),
};

/**
 * Cache keys for API responses
 */
export const CACHE_KEYS = {
  portfolio: 'portfolio_metrics',
  projects: (page: number) => `projects_page_${page}`,
  project: (id: string) => `project_${id}`,
  inspections: (projectId?: string) => `inspections_${projectId || 'all'}`,
  maintenance: (projectId?: string) => `maintenance_${projectId || 'all'}`,
  analytics: (projectId: string) => `analytics_${projectId}`,
  loans: (projectId?: string) => `loans_${projectId || 'all'}`,
  compliance: (projectId: string) => `compliance_${projectId}`,
};
