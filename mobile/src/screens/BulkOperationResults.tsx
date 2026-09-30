/**
 * Bulk Operation Results Screen
 * Display operation completion summary and detailed results
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import { Button } from '../components/Button';

interface OperationResult {
  itemId: string;
  status: 'success' | 'failed' | 'skipped';
  itemTitle: string;
  action: string;
  error?: string;
  timestamp: string;
}

interface BulkOperationSummary {
  operationId: string;
  operationType: string;
  totalItems: number;
  successful: number;
  failed: number;
  skipped: number;
  executionTime: number;
  startTime: string;
  completedTime: string;
  successRate: number;
  averageTimePerItem: number;
}

interface BulkOperationResultsProps {
  summary: BulkOperationSummary;
  results: OperationResult[];
  isRetrying?: boolean;
  canUndo?: boolean;
  canRetry?: boolean;
  onRetryFailed?: () => void;
  onUndo?: () => void;
  onExport?: () => void;
  onShare?: () => void;
  onReturn?: () => void;
}

export const BulkOperationResults: React.FC<BulkOperationResultsProps> = ({
  summary,
  results,
  isRetrying = false,
  canUndo = false,
  canRetry = summary.failed > 0,
  onRetryFailed,
  onUndo,
  onExport,
  onShare,
  onReturn,
}) => {
  const insets = useSafeAreaInsets();
  const [expandedError, setExpandedError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'failed' | 'skipped'>('all');

  const failedResults = results.filter(r => r.status === 'failed');
  const successResults = results.filter(r => r.status === 'success');

  const filteredResults = results.filter(r => {
    if (filterStatus === 'all') return true;
    return r.status === filterStatus;
  });

  const handleShare = useCallback(async () => {
    try {
      const message = `Bulk ${summary.operationType} Operation Complete\n\n` +
        `Total: ${summary.totalItems}\n` +
        `✓ Successful: ${summary.successful}\n` +
        `✗ Failed: ${summary.failed}\n` +
        `⊖ Skipped: ${summary.skipped}\n` +
        `Success Rate: ${summary.successRate}%\n` +
        `Time: ${formatTime(summary.executionTime)}`;

      await Share.share({
        message,
        title: 'Bulk Operation Results',
      });
    } catch (error) {
      console.error('Error sharing results:', error);
    }
  }, [summary]);

  const formatTime = (ms: number) => {
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  const statusColors = {
    success: '#388e3c',
    failed: '#d32f2f',
    skipped: '#f57c00',
  };

  const renderResultItem = ({ item }: { item: OperationResult; index: number }) => (
    <Card key={`${item.itemId}-${item.status}`} style={styles.resultItem}>
      <TouchableOpacity
        style={styles.resultContent}
        onPress={() => item.error && setExpandedError(
          expandedError === item.itemId ? null : item.itemId
        )}
      >
        <View style={styles.resultLeft}>
          <Text style={[styles.statusIcon, { color: statusColors[item.status] }]}>
            {item.status === 'success' ? '✓' : item.status === 'failed' ? '✗' : '⊖'}
          </Text>
          <View style={styles.resultInfo}>
            <Text style={styles.resultTitle} numberOfLines={1}>
              {item.itemTitle}
            </Text>
            <Text style={styles.resultAction}>{item.action}</Text>
          </View>
        </View>
        <Text style={[styles.resultStatus, { color: statusColors[item.status] }]}>
          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
        </Text>
      </TouchableOpacity>

      {/* Error Details */}
      {item.error && expandedError === item.itemId && (
        <View style={styles.errorDetails}>
          <Text style={styles.errorLabel}>Error:</Text>
          <Text style={styles.errorMessage}>{item.error}</Text>
        </View>
      )}
    </Card>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView style={styles.content}>
        {/* Summary Header */}
        <View style={styles.summaryHeader}>
          <Text style={styles.operationType}>
            {summary.operationType.charAt(0).toUpperCase() + summary.operationType.slice(1)} Operation
          </Text>
          <View style={[
            styles.statusBadge,
            summary.failed === 0 ? styles.completedBadge : styles.partialBadge,
          ]}>
            <Text style={styles.statusBadgeText}>
              {summary.failed === 0 ? 'Completed' : 'Completed with errors'}
            </Text>
          </View>
        </View>

        {/* Statistics Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{summary.totalItems}</Text>
            <Text style={styles.statLabel}>Total Items</Text>
          </View>
          <View style={[styles.statCard, styles.successCard]}>
            <Text style={styles.successValue}>{summary.successful}</Text>
            <Text style={styles.statLabel}>✓ Successful</Text>
          </View>
          <View style={[styles.statCard, summary.failed > 0 ? styles.failureCard : styles.successCard]}>
            <Text style={[styles.failureValue, summary.failed === 0 && { color: '#388e3c' }]}>
              {summary.failed}
            </Text>
            <Text style={styles.statLabel}>✗ Failed</Text>
          </View>
          {summary.skipped > 0 && (
            <View style={[styles.statCard, styles.skippedCard]}>
              <Text style={styles.skippedValue}>{summary.skipped}</Text>
              <Text style={styles.statLabel}>⊖ Skipped</Text>
            </View>
          )}
        </View>

        {/* Performance Metrics */}
        <View style={styles.metricsCard}>
          <Text style={styles.metricsTitle}>Performance</Text>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Success Rate:</Text>
            <Text style={styles.metricValue}>{summary.successRate}%</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Total Time:</Text>
            <Text style={styles.metricValue}>{formatTime(summary.executionTime)}</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Avg. per Item:</Text>
            <Text style={styles.metricValue}>{summary.averageTimePerItem.toFixed(2)}ms</Text>
          </View>
        </View>

        {/* Error Summary */}
        {failedResults.length > 0 && (
          <View style={styles.errorSummaryCard}>
            <Text style={styles.errorSummaryTitle}>Failed Items ({failedResults.length})</Text>
            <Text style={styles.errorSummaryMessage}>
              {failedResults.length} item{failedResults.length !== 1 ? 's' : ''} failed to process.
              {canRetry && ' Tap retry to process again.'}
            </Text>
          </View>
        )}

        {/* Results Filter */}
        {results.length > 0 && (
          <View style={styles.filterContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterTabs}
            >
              {(['all', 'success', 'failed', 'skipped'] as const).map(status => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.filterTab,
                    filterStatus === status && styles.filterTabActive,
                  ]}
                  onPress={() => setFilterStatus(status)}
                >
                  <Text style={[
                    styles.filterTabText,
                    filterStatus === status && styles.filterTabTextActive,
                  ]}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                    {status === 'all' && ` (${results.length})`}
                    {status === 'success' && ` (${successResults.length})`}
                    {status === 'failed' && ` (${failedResults.length})`}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Results List */}
        <View style={styles.resultsList}>
          {isRetrying && (
            <View style={styles.retryingContainer}>
              <ActivityIndicator size="small" color="#1976d2" />
              <Text style={styles.retryingText}>Retrying failed items...</Text>
            </View>
          )}
          {filteredResults.length === 0 ? (
            <View style={styles.emptyResults}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>No {filterStatus} items</Text>
            </View>
          ) : (
            filteredResults.map((item, index) => renderResultItem({ item, index }))
          )}
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.footer}>
        {canRetry && failedResults.length > 0 && (
          <Button
            label="🔄 Retry Failed"
            onPress={onRetryFailed}
            disabled={isRetrying}
            style={styles.actionButton}
          />
        )}
        {canUndo && (
          <Button
            label="↩️ Undo"
            onPress={onUndo}
            style={styles.actionButton}
          />
        )}
        {onExport && (
          <Button
            label="📥 Export"
            onPress={onExport}
            style={styles.actionButton}
          />
        )}
        <Button
          label="📤 Share"
          onPress={onShare || handleShare}
          style={styles.actionButton}
        />
        <Button
          label="✓ Done"
          onPress={onReturn}
          style={[styles.actionButton, styles.doneButton]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  summaryHeader: {
    marginBottom: 16,
  },
  operationType: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 8,
  },
  statusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  completedBadge: {
    backgroundColor: '#f1f8e9',
  },
  partialBadge: {
    backgroundColor: '#ffebee',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#212121',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  successCard: {
    backgroundColor: '#f1f8e9',
    borderColor: '#aed581',
  },
  failureCard: {
    backgroundColor: '#ffebee',
    borderColor: '#e57373',
  },
  skippedCard: {
    backgroundColor: '#fff3e0',
    borderColor: '#ffb74d',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1976d2',
    marginBottom: 4,
  },
  successValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#388e3c',
    marginBottom: 4,
  },
  failureValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#d32f2f',
    marginBottom: 4,
  },
  skippedValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f57c00',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  metricsCard: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 12,
  },
  metricsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 10,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#212121',
  },
  errorSummaryCard: {
    backgroundColor: '#ffebee',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e57373',
    marginBottom: 12,
  },
  errorSummaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#c62828',
    marginBottom: 4,
  },
  errorSummaryMessage: {
    fontSize: 12,
    color: '#d32f2f',
    lineHeight: 18,
  },
  filterContainer: {
    marginBottom: 12,
  },
  filterTabs: {
    gap: 8,
    paddingHorizontal: 4,
  },
  filterTab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterTabActive: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  filterTabTextActive: {
    color: '#fff',
  },
  resultsList: {
    marginBottom: 16,
  },
  retryingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  retryingText: {
    fontSize: 13,
    color: '#1976d2',
    fontWeight: '500',
  },
  emptyResults: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
  resultItem: {
    marginBottom: 0,
  },
  resultContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 12,
  },
  resultLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusIcon: {
    fontSize: 18,
    fontWeight: '700',
  },
  resultInfo: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 2,
  },
  resultAction: {
    fontSize: 11,
    color: '#999',
  },
  resultStatus: {
    fontSize: 11,
    fontWeight: '600',
  },
  errorDetails: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    backgroundColor: '#ffebee',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#d32f2f',
  },
  errorLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#c62828',
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 12,
    color: '#d32f2f',
    lineHeight: 16,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  actionButton: {
    marginBottom: 0,
    minWidth: '46%',
  },
  doneButton: {
    backgroundColor: '#388e3c',
  },
});
