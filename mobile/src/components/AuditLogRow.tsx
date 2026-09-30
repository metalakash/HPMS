/**
 * Audit Log Row Component
 * Reusable audit log table row
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  userEmail: string;
  feature: string;
  summary: string;
  severity: 'info' | 'warning' | 'critical';
}

interface AuditLogRowProps {
  log: AuditLog;
  onSelect: (log: AuditLog) => void;
  isSelected: boolean;
}

export const AuditLogRow: React.FC<AuditLogRowProps> = ({ log, onSelect, isSelected }) => {
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

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const today = new Date();

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    return date.toLocaleDateString();
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isSelected && styles.containerSelected,
      ]}
      onPress={() => onSelect(log)}
      testID={`audit-log-row-${log.id}`}
    >
      <View style={styles.leftBorder} />

      <View style={styles.content}>
        {/* Header Row: Timestamp + Severity */}
        <View style={styles.headerRow}>
          <Text style={styles.timestamp}>{formatTimestamp(log.timestamp)}</Text>
          <View
            style={[
              styles.severityBadge,
              { backgroundColor: getSeverityColor(log.severity) },
            ]}
          >
            <Text style={styles.severityText}>{log.severity.charAt(0).toUpperCase()}</Text>
          </View>
        </View>

        {/* Action + User Row */}
        <View style={styles.actionRow}>
          <View
            style={[
              styles.actionBadge,
              { backgroundColor: getActionColor(log.action) },
            ]}
          >
            <Text style={styles.actionText}>{log.action}</Text>
          </View>
          <Text style={styles.user}>{log.userEmail}</Text>
        </View>

        {/* Feature + Summary Row */}
        <View style={styles.detailRow}>
          <Text style={styles.feature}>{log.feature}</Text>
          <Text style={styles.summary} numberOfLines={1}>
            {log.summary}
          </Text>
        </View>
      </View>

      {/* Right Chevron */}
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingRight: 12,
    marginHorizontal: 8,
    marginVertical: 4,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  containerSelected: {
    backgroundColor: '#f0f7ff',
    borderLeftColor: '#1976D2',
  },
  leftBorder: {
    width: 4,
    height: '100%',
    backgroundColor: '#2196F3',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  timestamp: {
    fontSize: 11,
    color: '#999',
    fontWeight: '500',
  },
  severityBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  severityText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  actionBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  actionText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  user: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  feature: {
    fontSize: 11,
    color: '#2196F3',
    fontWeight: '600',
    paddingVertical: 2,
    paddingHorizontal: 6,
    backgroundColor: '#e3f2fd',
    borderRadius: 3,
  },
  summary: {
    flex: 1,
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  chevron: {
    fontSize: 24,
    color: '#ccc',
    marginLeft: 8,
  },
});
