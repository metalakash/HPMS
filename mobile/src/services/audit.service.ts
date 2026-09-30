/**
 * Audit Service
 * Core audit logging and data access layer
 */

export type ActionType = 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'IMPORT' | 'ROLLBACK';
export type Severity = 'info' | 'warning' | 'critical';
export type Feature = 'projects' | 'inspections' | 'workorders' | 'compliance' | 'reports';

export interface FieldChange {
  field: string;
  before: any;
  after: any;
  type: 'string' | 'number' | 'date' | 'object' | 'array';
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  action: ActionType;
  feature: Feature;
  recordId: string;
  recordType: string;
  changes?: FieldChange[];
  before?: any;
  after?: any;
  ipAddress: string;
  userAgent: string;
  sessionId: string;
  severity: Severity;
  metadata?: Record<string, any>;
}

export interface AuditEventInput {
  action: ActionType;
  feature: Feature;
  recordId: string;
  recordType: string;
  userId: string;
  userEmail: string;
  before?: any;
  after?: any;
  changes?: FieldChange[];
  metadata?: Record<string, any>;
}

export interface AuditLogQuery {
  dateRange?: { start: Date; end: Date };
  actionType?: ActionType | 'all';
  feature?: Feature | 'all';
  userId?: string;
  text?: string;
  page?: number;
  limit?: number;
}

export interface AuditStats {
  totalEvents: number;
  creates: number;
  updates: number;
  deletes: number;
  exports: number;
  imports: number;
  rollbacks: number;
  topUsers: Array<{ email: string; count: number }>;
  actionBreakdown: Record<ActionType, number>;
  featureBreakdown: Record<Feature, number>;
}

class AuditService {
  private logs: AuditLog[] = [];
  private logCounter = 0;

  /**
   * Log an audit event with full context
   */
  async logEvent(event: AuditEventInput, context?: {
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
  }): Promise<AuditLog> {
    const auditLog: AuditLog = {
      id: `log-${++this.logCounter}`,
      timestamp: new Date().toISOString(),
      userId: event.userId,
      userEmail: event.userEmail,
      action: event.action,
      feature: event.feature,
      recordId: event.recordId,
      recordType: event.recordType,
      changes: event.changes,
      before: event.before,
      after: event.after,
      ipAddress: context?.ipAddress || 'unknown',
      userAgent: context?.userAgent || 'unknown',
      sessionId: context?.sessionId || 'unknown',
      severity: this.determineSeverity(event.action, event.metadata),
      metadata: event.metadata,
    };

    this.logs.push(auditLog);
    return auditLog;
  }

  /**
   * Fetch a single log by ID
   */
  async getLog(logId: string): Promise<AuditLog | null> {
    const log = this.logs.find(l => l.id === logId);
    return log || null;
  }

  /**
   * Search logs with full-text search and filtering
   */
  async searchLogs(query: AuditLogQuery): Promise<{
    logs: AuditLog[];
    total: number;
  }> {
    let filtered = [...this.logs];

    // Date range filter
    if (query.dateRange) {
      const startTime = query.dateRange.start.getTime();
      const endTime = query.dateRange.end.getTime();
      filtered = filtered.filter(log => {
        const logTime = new Date(log.timestamp).getTime();
        return logTime >= startTime && logTime <= endTime;
      });
    }

    // Action type filter
    if (query.actionType && query.actionType !== 'all') {
      filtered = filtered.filter(log => log.action === query.actionType);
    }

    // Feature filter
    if (query.feature && query.feature !== 'all') {
      filtered = filtered.filter(log => log.feature === query.feature);
    }

    // User ID filter
    if (query.userId) {
      filtered = filtered.filter(log => log.userId === query.userId);
    }

    // Full-text search on changes and summary
    if (query.text) {
      const searchLower = query.text.toLowerCase();
      filtered = filtered.filter(log => {
        const textContent = [
          log.recordType,
          log.userEmail,
          log.recordId,
          JSON.stringify(log.changes || {}),
          JSON.stringify(log.metadata || {}),
        ]
          .join(' ')
          .toLowerCase();
        return textContent.includes(searchLower);
      });
    }

    // Sort by timestamp descending
    filtered.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Pagination
    const page = query.page || 1;
    const limit = query.limit || 25;
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedLogs = filtered.slice(start, end);

    return {
      logs: paginatedLogs,
      total: filtered.length,
    };
  }

  /**
   * Get all actions by a specific user
   */
  async getUserLogs(userId: string, limit?: number): Promise<AuditLog[]> {
    return this.logs
      .filter(log => log.userId === userId)
      .sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, limit || 50);
  }

  /**
   * Get complete history for a specific record
   */
  async getRecordHistory(recordId: string, feature: string): Promise<AuditLog[]> {
    return this.logs
      .filter(log => log.recordId === recordId && log.feature === feature)
      .sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
  }

  /**
   * Export logs to CSV or JSON format
   */
  async exportLogs(query: AuditLogQuery, format: 'csv' | 'json'): Promise<Blob> {
    const result = await this.searchLogs(query);

    if (format === 'json') {
      return this.exportAsJSON(result.logs);
    } else {
      return this.exportAsCSV(result.logs);
    }
  }

  /**
   * Get aggregated statistics for a date range
   */
  async getStats(dateRange?: { start: Date; end: Date }): Promise<AuditStats> {
    let filtered = [...this.logs];

    if (dateRange) {
      const startTime = dateRange.start.getTime();
      const endTime = dateRange.end.getTime();
      filtered = filtered.filter(log => {
        const logTime = new Date(log.timestamp).getTime();
        return logTime >= startTime && logTime <= endTime;
      });
    }

    const stats: AuditStats = {
      totalEvents: filtered.length,
      creates: filtered.filter(l => l.action === 'CREATE').length,
      updates: filtered.filter(l => l.action === 'UPDATE').length,
      deletes: filtered.filter(l => l.action === 'DELETE').length,
      exports: filtered.filter(l => l.action === 'EXPORT').length,
      imports: filtered.filter(l => l.action === 'IMPORT').length,
      rollbacks: filtered.filter(l => l.action === 'ROLLBACK').length,
      topUsers: this.getTopUsers(filtered),
      actionBreakdown: this.getActionBreakdown(filtered),
      featureBreakdown: this.getFeatureBreakdown(filtered),
    };

    return stats;
  }

  /**
   * Check if a log can be rolled back
   */
  async canRollback(logId: string): Promise<boolean> {
    const log = await this.getLog(logId);
    if (!log) return false;

    // Can't rollback already-rolled-back events
    if (log.action === 'ROLLBACK') return false;

    // Can't rollback if data is missing
    if (!log.before && log.action === 'UPDATE') return false;
    if (!log.after && log.action === 'DELETE') return false;

    // Check time limit (can't rollback older than 30 days)
    const logTime = new Date(log.timestamp).getTime();
    const now = new Date().getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    return now - logTime < thirtyDaysMs;
  }

  /**
   * Execute rollback (admin only)
   */
  async rollbackEvent(logId: string, reason: string): Promise<void> {
    const log = await this.getLog(logId);
    if (!log) throw new Error('Log not found');

    const canRollback = await this.canRollback(logId);
    if (!canRollback) throw new Error('Cannot rollback this event');

    // Create a rollback log entry
    const rollbackLog: AuditLog = {
      id: `log-${++this.logCounter}`,
      timestamp: new Date().toISOString(),
      userId: 'admin',
      userEmail: 'admin@system',
      action: 'ROLLBACK',
      feature: log.feature,
      recordId: log.recordId,
      recordType: log.recordType,
      ipAddress: 'system',
      userAgent: 'admin-api',
      sessionId: 'admin-session',
      severity: 'warning',
      metadata: {
        originalLogId: logId,
        reason,
        restoredAction: log.action,
      },
    };

    this.logs.push(rollbackLog);
  }

  /**
   * Determine severity based on action and context
   */
  private determineSeverity(action: ActionType, metadata?: Record<string, any>): Severity {
    // DELETE operations are critical
    if (action === 'DELETE') return 'critical';

    // ROLLBACK operations are warnings
    if (action === 'ROLLBACK') return 'warning';

    // EXPORT/IMPORT with large data are warnings
    if ((action === 'EXPORT' || action === 'IMPORT') && metadata?.isLargeOperation) {
      return 'warning';
    }

    // Everything else is info
    return 'info';
  }

  /**
   * Get top users by action count
   */
  private getTopUsers(logs: AuditLog[]): Array<{ email: string; count: number }> {
    const userCounts: Record<string, number> = {};

    logs.forEach(log => {
      userCounts[log.userEmail] = (userCounts[log.userEmail] || 0) + 1;
    });

    return Object.entries(userCounts)
      .map(([email, count]) => ({ email, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Get action breakdown statistics
   */
  private getActionBreakdown(logs: AuditLog[]): Record<ActionType, number> {
    const actionTypes: ActionType[] = ['CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'IMPORT', 'ROLLBACK'];
    const breakdown: Record<ActionType, number> = {
      CREATE: 0,
      UPDATE: 0,
      DELETE: 0,
      EXPORT: 0,
      IMPORT: 0,
      ROLLBACK: 0,
    };

    logs.forEach(log => {
      breakdown[log.action]++;
    });

    return breakdown;
  }

  /**
   * Get feature breakdown statistics
   */
  private getFeatureBreakdown(logs: AuditLog[]): Record<Feature, number> {
    const features: Feature[] = ['projects', 'inspections', 'workorders', 'compliance', 'reports'];
    const breakdown: Record<Feature, number> = {
      projects: 0,
      inspections: 0,
      workorders: 0,
      compliance: 0,
      reports: 0,
    };

    logs.forEach(log => {
      if (log.feature in breakdown) {
        breakdown[log.feature]++;
      }
    });

    return breakdown;
  }

  /**
   * Export logs as JSON
   */
  private exportAsJSON(logs: AuditLog[]): Blob {
    const json = JSON.stringify({
      exportDate: new Date().toISOString(),
      totalRecords: logs.length,
      logs,
    }, null, 2);

    return new Blob([json], { type: 'application/json' });
  }

  /**
   * Export logs as CSV
   */
  private exportAsCSV(logs: AuditLog[]): Blob {
    const headers = [
      'ID',
      'Timestamp',
      'Action',
      'Feature',
      'User Email',
      'Record ID',
      'Record Type',
      'Severity',
      'IP Address',
    ];

    const rows = logs.map(log => [
      log.id,
      log.timestamp,
      log.action,
      log.feature,
      log.userEmail,
      log.recordId,
      log.recordType,
      log.severity,
      log.ipAddress,
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    return new Blob([csv], { type: 'text/csv' });
  }
}

export const auditService = new AuditService();
