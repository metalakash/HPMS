/**
 * Audit Log Screen
 * Master audit log viewer with filtering, search, and export
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';

interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'IMPORT' | 'ROLLBACK';
  feature: string;
  recordId: string;
  summary: string;
  severity: 'info' | 'warning' | 'critical';
}

interface AuditFilters {
  startDate: Date;
  endDate: Date;
  actionType: string;
  feature: string;
  user: string;
  searchText: string;
}

interface PaginationState {
  page: number;
  limit: number;
  total: number;
}

export const AuditLogScreen: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'details'>('list');

  const [filters, setFilters] = useState<AuditFilters>({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
    actionType: 'all',
    feature: 'all',
    user: 'all',
    searchText: '',
  });

  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 25,
    total: 0,
  });

  const [showDatePicker, setShowDatePicker] = useState<'start' | 'end' | null>(null);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      // Simulate API call
      const mockLogs: AuditLog[] = [
        {
          id: 'log-1',
          timestamp: new Date().toISOString(),
          userId: 'user-1',
          userEmail: 'akash@example.com',
          action: 'UPDATE',
          feature: 'Projects',
          recordId: 'proj-123',
          summary: 'Updated project status to Active',
          severity: 'info',
        },
        {
          id: 'log-2',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          userId: 'user-1',
          userEmail: 'akash@example.com',
          action: 'CREATE',
          feature: 'Inspections',
          recordId: 'insp-456',
          summary: 'Created new inspection',
          severity: 'info',
        },
      ];
      setLogs(mockLogs);
      setPagination(prev => ({ ...prev, total: mockLogs.length }));
    } catch (error) {
      console.error('Error loading audit logs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDateChange = (date: Date) => {
    if (showDatePicker === 'start') {
      setFilters(prev => ({ ...prev, startDate: date }));
    } else if (showDatePicker === 'end') {
      setFilters(prev => ({ ...prev, endDate: date }));
    }
    setShowDatePicker(null);
  };

  const updateFilters = useCallback(async (newFilters: Partial<AuditFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPagination(prev => ({ ...prev, page: 1 }));
    await loadLogs();
  }, [loadLogs]);

  const clearFilters = useCallback(() => {
    setFilters({
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
      actionType: 'all',
      feature: 'all',
      user: 'all',
      searchText: '',
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  const selectLog = useCallback((log: AuditLog) => {
    setSelectedLog(log);
    setViewMode('details');
  }, []);

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

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const renderLogRow = ({ item }: { item: AuditLog }) => (
    <TouchableOpacity
      style={styles.logRow}
      onPress={() => selectLog(item)}
      testID="audit-log-row"
    >
      <View style={styles.rowContent}>
        <Text style={styles.timestamp}>{formatTimestamp(item.timestamp)}</Text>

        <View style={styles.actionBadgeContainer}>
          <View
            style={[
              styles.actionBadge,
              { backgroundColor: getActionColor(item.action) },
            ]}
          >
            <Text style={styles.actionText}>{item.action}</Text>
          </View>
          <Text style={styles.user}>{item.userEmail}</Text>
        </View>

        <Text style={styles.feature}>{item.feature}</Text>
        <Text style={styles.summary}>{item.summary}</Text>
      </View>

      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );

  if (viewMode === 'details' && selectedLog) {
    return (
      <View style={styles.container}>
        <View style={styles.detailHeader}>
          <TouchableOpacity
            onPress={() => setViewMode('list')}
            testID="back-button"
          >
            <Text style={styles.backButton}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.detailTitle}>Event Details</Text>
        </View>

        <ScrollView style={styles.detailContent}>
          <View style={styles.detailCard}>
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Action:</Text>
              <View
                style={[
                  styles.actionBadge,
                  { backgroundColor: getActionColor(selectedLog.action) },
                ]}
              >
                <Text style={styles.actionText}>{selectedLog.action}</Text>
              </View>
            </View>

            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Timestamp:</Text>
              <Text style={styles.metadataValue}>
                {formatTimestamp(selectedLog.timestamp)}
              </Text>
            </View>

            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>User:</Text>
              <Text style={styles.metadataValue}>{selectedLog.userEmail}</Text>
            </View>

            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Feature:</Text>
              <Text style={styles.metadataValue}>{selectedLog.feature}</Text>
            </View>

            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Record ID:</Text>
              <Text style={styles.metadataValue}>{selectedLog.recordId}</Text>
            </View>

            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Summary:</Text>
              <Text style={styles.metadataValue}>{selectedLog.summary}</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="audit-log-screen">
      {/* Filter Header */}
      <View style={styles.filterHeader}>
        <TextInput
          style={styles.searchBox}
          placeholder="Search logs..."
          value={filters.searchText}
          onChangeText={(text) =>
            updateFilters({ searchText: text })
          }
          testID="search-box"
        />
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilterPanel(!showFilterPanel)}
          testID="filter-button"
        >
          <Text style={styles.filterButtonText}>⚙</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Panel */}
      {showFilterPanel && (
        <View style={styles.filterPanel}>
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Start Date:</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker('start')}
              testID="date-start-button"
            >
              <Text style={styles.dateButtonText}>
                {filters.startDate.toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>End Date:</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker('end')}
              testID="date-end-button"
            >
              <Text style={styles.dateButtonText}>
                {filters.endDate.toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Action Type:</Text>
            <Picker
              selectedValue={filters.actionType}
              style={styles.picker}
              onValueChange={(value) => updateFilters({ actionType: value })}
              testID="action-picker"
            >
              <Picker.Item label="All" value="all" />
              <Picker.Item label="Create" value="CREATE" />
              <Picker.Item label="Update" value="UPDATE" />
              <Picker.Item label="Delete" value="DELETE" />
              <Picker.Item label="Export" value="EXPORT" />
              <Picker.Item label="Import" value="IMPORT" />
            </Picker>
          </View>

          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Feature:</Text>
            <Picker
              selectedValue={filters.feature}
              style={styles.picker}
              onValueChange={(value) => updateFilters({ feature: value })}
              testID="feature-picker"
            >
              <Picker.Item label="All" value="all" />
              <Picker.Item label="Projects" value="Projects" />
              <Picker.Item label="Inspections" value="Inspections" />
              <Picker.Item label="Work Orders" value="WorkOrders" />
              <Picker.Item label="Compliance" value="Compliance" />
            </Picker>
          </View>

          <View style={styles.filterButtonRow}>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={clearFilters}
              testID="clear-filters-button"
            >
              <Text style={styles.clearButtonText}>Clear Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={showDatePicker === 'start' ? filters.startDate : filters.endDate}
          mode="date"
          display="default"
          onChange={(event, date) => {
            if (date) handleDateChange(date);
          }}
        />
      )}

      {/* Logs List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      ) : (
        <FlatList
          data={logs}
          renderItem={renderLogRow}
          keyExtractor={(item) => item.id}
          style={styles.listContainer}
          onEndReached={() => {
            if (pagination.page * pagination.limit < pagination.total) {
              setPagination(prev => ({ ...prev, page: prev.page + 1 }));
            }
          }}
          testID="audit-logs-list"
        />
      )}

      {/* Empty State */}
      {!loading && logs.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No audit logs found</Text>
        </View>
      )}

      {/* Pagination Info */}
      {logs.length > 0 && (
        <View style={styles.paginationInfo}>
          <Text style={styles.paginationText}>
            Page {pagination.page} of {Math.ceil(pagination.total / pagination.limit)}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  filterHeader: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchBox: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 12,
    backgroundColor: '#fafafa',
    marginRight: 8,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonText: {
    color: '#fff',
    fontSize: 18,
  },
  filterPanel: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    padding: 12,
  },
  filterRow: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  dateButton: {
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#fafafa',
  },
  dateButtonText: {
    fontSize: 14,
    color: '#333',
  },
  picker: {
    height: 40,
    backgroundColor: '#fafafa',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  filterButtonRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  clearButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#f44336',
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    flex: 1,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginHorizontal: 8,
    marginVertical: 4,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  rowContent: {
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  actionBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  actionBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  actionText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  user: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  feature: {
    fontSize: 12,
    color: '#2196F3',
    marginVertical: 2,
  },
  summary: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  chevron: {
    fontSize: 24,
    color: '#ccc',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
  },
  paginationInfo: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
  },
  paginationText: {
    fontSize: 13,
    color: '#666',
  },
  detailHeader: {
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
  detailTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 16,
    flex: 1,
  },
  detailContent: {
    flex: 1,
    padding: 12,
  },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
  },
  metadataRow: {
    marginBottom: 16,
    paddingBottomWidth: 1,
    paddingBottomColor: '#e0e0e0',
  },
  metadataLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  metadataValue: {
    fontSize: 14,
    color: '#333',
  },
});
