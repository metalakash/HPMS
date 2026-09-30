/**
 * Audit Detail Screen
 * Detailed view of a single audit event with before/after comparison
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';

interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'IMPORT' | 'ROLLBACK';
  feature: string;
  recordId: string;
  recordType: string;
  changes?: FieldChange[];
  before?: any;
  after?: any;
  ipAddress: string;
  userAgent: string;
  sessionId: string;
  severity: 'info' | 'warning' | 'critical';
  metadata?: Record<string, any>;
}

interface FieldChange {
  field: string;
  before: any;
  after: any;
}

interface AuditDetailScreenProps {
  logId: string;
  onBack: () => void;
}

export const AuditDetailScreen: React.FC<AuditDetailScreenProps> = ({ logId, onBack }) => {
  const [log, setLog] = useState<AuditLog | null>(null);
  const [relatedLogs, setRelatedLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showJSON, setShowJSON] = useState(false);
  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false);
  const [rollbackLoading, setRollbackLoading] = useState(false);

  useEffect(() => {
    loadLogDetails();
  }, [logId]);

  const loadLogDetails = async () => {
    setLoading(true);
    try {
      // Simulate API call
      const mockLog: AuditLog = {
        id: logId,
        timestamp: new Date().toISOString(),
        userId: 'user-1',
        userEmail: 'akash@example.com',
        action: 'UPDATE',
        feature: 'Projects',
        recordId: 'proj-123',
        recordType: 'Project',
        changes: [
          {
            field: 'status',
            before: 'Pending',
            after: 'Active',
          },
          {
            field: 'name',
            before: 'Old Project Name',
            after: 'New Project Name',
          },
        ],
        before: { id: 'proj-123', status: 'Pending', name: 'Old Project Name' },
        after: { id: 'proj-123', status: 'Active', name: 'New Project Name' },
        ipAddress: '192.168.1.100',
        userAgent: 'Mobile App v1.0',
        sessionId: 'sess-abc123',
        severity: 'info',
      };

      const mockRelated: AuditLog[] = [
        {
          id: 'log-2',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          userId: 'user-2',
          userEmail: 'john@example.com',
          action: 'UPDATE',
          feature: 'Projects',
          recordId: 'proj-123',
          recordType: 'Project',
          ipAddress: '192.168.1.101',
          userAgent: 'Mobile App v1.0',
          sessionId: 'sess-def456',
          severity: 'info',
        },
      ];

      setLog(mockLog);
      setRelatedLogs(mockRelated);
    } catch (error) {
      console.error('Error loading audit log:', error);
      Alert.alert('Error', 'Failed to load audit log details');
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async () => {
    if (!log) return;

    setRollbackLoading(true);
    try {
      // Simulate API call
      Alert.alert(
        'Success',
        'Record has been restored to its previous state',
        [{ text: 'OK', onPress: () => setShowRollbackConfirm(false) }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to rollback record');
    } finally {
      setRollbackLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!log || !log.after) return;
    try {
      await Share.share({
        message: JSON.stringify(log.after, null, 2),
      });
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getActionColor = (action: string): string => {
    switch (action) {
      case 'CREATE':
        return '#4CAF50';
      case 'UPDATE':
        return '#2196F3';
      case 'DELETE':
        return '#F44336';
      case 'EXPORT':
        return '#FF9800';
      case 'IMPORT':
        return '#9C27B0';
      case 'ROLLBACK':
        return '#E91E63';
      default:
        return '#757575';
    }
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return '#F44336';
      case 'warning':
        return '#FF9800';
      default:
        return '#4CAF50';
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} testID="back-button">
            <Text style={styles.backButton}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Event Details</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      </View>
    );
  }

  if (!log) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.backButton}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Event Details</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Log not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="audit-detail-screen">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} testID="back-button">
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Event Details</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Action Badge */}
        <View style={styles.actionSection}>
          <View
            style={[
              styles.actionBadge,
              { backgroundColor: getActionColor(log.action) },
            ]}
          >
            <Text style={styles.actionBadgeText}>{log.action}</Text>
          </View>
          <View
            style={[
              styles.severityBadge,
              { backgroundColor: getSeverityColor(log.severity) },
            ]}
          >
            <Text style={styles.severityText}>{log.severity.toUpperCase()}</Text>
          </View>
        </View>

        {/* Timestamp */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timestamp</Text>
          <Text style={styles.sectionValue}>
            {formatTimestamp(log.timestamp)} UTC
          </Text>
        </View>

        {/* Metadata */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Metadata</Text>
          <View style={styles.metadataCard}>
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>User:</Text>
              <Text style={styles.metadataValue}>{log.userEmail}</Text>
            </View>
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Feature:</Text>
              <Text style={styles.metadataValue}>{log.feature}</Text>
            </View>
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Record ID:</Text>
              <Text style={styles.metadataValue}>{log.recordId}</Text>
            </View>
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>IP Address:</Text>
              <Text style={styles.metadataValue}>{log.ipAddress}</Text>
            </View>
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Session ID:</Text>
              <Text style={[styles.metadataValue, styles.monospace]}>
                {log.sessionId}
              </Text>
            </View>
          </View>
        </View>

        {/* Changes (for UPDATE) */}
        {log.action === 'UPDATE' && log.changes && log.changes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Changes</Text>
            <View style={styles.changesCard}>
              {log.changes.map((change, index) => (
                <View key={index} style={styles.changeRow}>
                  <Text style={styles.changeField}>{change.field}</Text>
                  <View style={styles.changeValues}>
                    <View style={styles.beforeValue}>
                      <Text style={styles.changeLabel}>Before</Text>
                      <Text style={styles.changeContent}>
                        {JSON.stringify(change.before)}
                      </Text>
                    </View>
                    <View style={styles.arrowContainer}>
                      <Text style={styles.arrow}>→</Text>
                    </View>
                    <View style={styles.afterValue}>
                      <Text style={styles.changeLabel}>After</Text>
                      <Text style={styles.changeContent}>
                        {JSON.stringify(change.after)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Full Data */}
        <View style={styles.section}>
          <View style={styles.jsonHeader}>
            <Text style={styles.sectionTitle}>Full Data</Text>
            <TouchableOpacity
              onPress={() => setShowJSON(!showJSON)}
              testID="toggle-json"
            >
              <Text style={styles.toggleButton}>
                {showJSON ? 'Hide' : 'Show'}
              </Text>
            </TouchableOpacity>
          </View>

          {showJSON && (
            <View style={styles.jsonContainer}>
              <Text style={styles.jsonText}>
                {JSON.stringify(log.after, null, 2)}
              </Text>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={copyToClipboard}
                testID="copy-button"
              >
                <Text style={styles.copyButtonText}>Copy JSON</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Related Events */}
        {relatedLogs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Related Events</Text>
            <View style={styles.relatedEventsCard}>
              {relatedLogs.map((relLog) => (
                <TouchableOpacity
                  key={relLog.id}
                  style={styles.relatedEventRow}
                  testID="related-event-row"
                >
                  <View style={styles.relatedEventContent}>
                    <Text style={styles.relatedEventTimestamp}>
                      {formatTimestamp(relLog.timestamp)}
                    </Text>
                    <Text style={styles.relatedEventAction}>
                      {relLog.action} by {relLog.userEmail}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Rollback Section (admin only) */}
        {log.action !== 'ROLLBACK' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Admin Actions</Text>
            {!showRollbackConfirm ? (
              <TouchableOpacity
                style={styles.rollbackButton}
                onPress={() => setShowRollbackConfirm(true)}
                testID="rollback-button"
              >
                <Text style={styles.rollbackButtonText}>Restore Record</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.confirmContainer}>
                <Text style={styles.confirmText}>
                  Are you sure you want to restore this record to its previous state?
                </Text>
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setShowRollbackConfirm(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={handleRollback}
                    disabled={rollbackLoading}
                  >
                    {rollbackLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.confirmButtonText}>Confirm</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 16,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  content: {
    flex: 1,
    padding: 12,
  },
  actionSection: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  actionBadge: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  actionBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  severityBadge: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  severityText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sectionValue: {
    fontSize: 14,
    color: '#666',
  },
  metadataCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  metadataLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  metadataValue: {
    fontSize: 12,
    color: '#333',
    flex: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  monospace: {
    fontFamily: 'Courier New',
  },
  changesCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
  },
  changeRow: {
    marginBottom: 16,
    paddingBottomWidth: 1,
    paddingBottomColor: '#f0f0f0',
  },
  changeField: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  changeValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  beforeValue: {
    flex: 1,
    backgroundColor: '#ffebee',
    borderRadius: 6,
    padding: 8,
  },
  afterValue: {
    flex: 1,
    backgroundColor: '#e8f5e9',
    borderRadius: 6,
    padding: 8,
  },
  arrowContainer: {
    paddingHorizontal: 4,
  },
  arrow: {
    fontSize: 16,
    color: '#999',
  },
  changeLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  changeContent: {
    fontSize: 12,
    color: '#333',
  },
  jsonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  toggleButton: {
    fontSize: 13,
    color: '#2196F3',
    fontWeight: '600',
  },
  jsonContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
  },
  jsonText: {
    fontSize: 11,
    fontFamily: 'Courier New',
    color: '#333',
    marginBottom: 12,
  },
  copyButton: {
    backgroundColor: '#2196F3',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  relatedEventsCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
  },
  relatedEventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  relatedEventContent: {
    flex: 1,
  },
  relatedEventTimestamp: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  relatedEventAction: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  chevron: {
    fontSize: 20,
    color: '#ccc',
  },
  rollbackButton: {
    backgroundColor: '#f44336',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  rollbackButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  confirmText: {
    fontSize: 13,
    color: '#333',
    marginBottom: 16,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 6,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    borderRadius: 6,
    paddingVertical: 10,
    backgroundColor: '#f44336',
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
