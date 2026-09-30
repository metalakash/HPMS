/**
 * Progress Tracker Component
 * Real-time progress visualization during bulk operation execution
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

interface ProgressTrackerProps {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  currentItem?: string;
  elapsedTime: number;
  isPaused?: boolean;
  onCancel?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  canCancel?: boolean;
  recentItems?: Array<{ title: string; status: 'success' | 'failed' | 'skipped' }>;
}

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  total,
  processed,
  successful,
  failed,
  skipped,
  currentItem,
  elapsedTime,
  isPaused = false,
  onCancel,
  onPause,
  onResume,
  canCancel = true,
  recentItems = [],
}) => {
  const progressAnim = React.useRef(new Animated.Value(0)).current;

  const percentage = total > 0 ? (processed / total) * 100 : 0;

  React.useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: percentage,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [percentage, progressAnim]);

  const estimatedTimeRemaining = useMemo(() => {
    if (processed === 0 || elapsedTime === 0) return 0;
    const itemsPerSecond = processed / (elapsedTime / 1000);
    const remainingItems = total - processed;
    return Math.round(remainingItems / itemsPerSecond);
  }, [processed, elapsedTime, total]);

  const formatTime = (ms: number) => {
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const itemsPerSecond = processed > 0 && elapsedTime > 0
    ? (processed / (elapsedTime / 1000)).toFixed(1)
    : '0';

  const statusIcons = {
    success: '✓',
    failed: '✗',
    skipped: '⊖',
  };

  return (
    <View style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressBarContainer}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
        <Text style={styles.percentageText}>{Math.round(percentage)}%</Text>
      </View>

      {/* Status Badges */}
      <View style={styles.statusRow}>
        <View style={styles.statusBadge}>
          <Text style={styles.statusLabel}>Processed</Text>
          <Text style={styles.statusValue}>{processed} / {total}</Text>
        </View>
        <View style={[styles.statusBadge, styles.successBadge]}>
          <Text style={styles.statusLabel}>✓ Success</Text>
          <Text style={[styles.statusValue, { color: '#388e3c' }]}>{successful}</Text>
        </View>
        <View style={[styles.statusBadge, styles.failureBadge]}>
          <Text style={styles.statusLabel}>✗ Failed</Text>
          <Text style={[styles.statusValue, { color: '#d32f2f' }]}>{failed}</Text>
        </View>
        {skipped > 0 && (
          <View style={[styles.statusBadge, styles.skippedBadge]}>
            <Text style={styles.statusLabel}>⊖ Skipped</Text>
            <Text style={[styles.statusValue, { color: '#f57c00' }]}>{skipped}</Text>
          </View>
        )}
      </View>

      {/* Current Item */}
      {currentItem && (
        <View style={styles.currentItemContainer}>
          <Text style={styles.currentItemLabel}>Processing:</Text>
          <Text style={styles.currentItemTitle} numberOfLines={1}>
            {currentItem}
          </Text>
        </View>
      )}

      {/* Timing Information */}
      <View style={styles.timingRow}>
        <View style={styles.timingItem}>
          <Text style={styles.timingLabel}>Elapsed</Text>
          <Text style={styles.timingValue}>{formatTime(elapsedTime)}</Text>
        </View>
        {estimatedTimeRemaining > 0 && (
          <View style={styles.timingItem}>
            <Text style={styles.timingLabel}>Est. Remaining</Text>
            <Text style={styles.timingValue}>{formatTime(estimatedTimeRemaining * 1000)}</Text>
          </View>
        )}
        <View style={styles.timingItem}>
          <Text style={styles.timingLabel}>Speed</Text>
          <Text style={styles.timingValue}>{itemsPerSecond} items/s</Text>
        </View>
      </View>

      {/* Recent Items Log */}
      {recentItems.length > 0 && (
        <View style={styles.recentItemsContainer}>
          <Text style={styles.recentItemsTitle}>Recent Activity</Text>
          <ScrollView style={styles.recentItemsList}>
            {recentItems.map((item, index) => (
              <View key={index} style={styles.recentItem}>
                <Text style={styles.statusIcon}>{statusIcons[item.status]}</Text>
                <Text style={styles.recentItemTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[
                  styles.recentItemStatus,
                  item.status === 'success' && { color: '#388e3c' },
                  item.status === 'failed' && { color: '#d32f2f' },
                  item.status === 'skipped' && { color: '#f57c00' },
                ]}>
                  {item.status}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {isPaused ? (
          <TouchableOpacity style={styles.actionButton} onPress={onResume}>
            <Text style={styles.actionButtonText}>▶ Resume</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.actionButton} onPress={onPause}>
            <Text style={styles.actionButtonText}>⏸ Pause</Text>
          </TouchableOpacity>
        )}
        {canCancel && (
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={onCancel}
          >
            <Text style={styles.cancelButtonText}>✕ Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Status Message */}
      {isPaused && (
        <View style={styles.statusMessage}>
          <Text style={styles.statusMessageText}>Operation paused</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  progressSection: {
    marginBottom: 16,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#1976d2',
    borderRadius: 4,
  },
  percentageText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
    textAlign: 'right',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  statusBadge: {
    flex: 1,
    minWidth: 70,
    backgroundColor: '#f5f5f5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  successBadge: {
    backgroundColor: '#f1f8e9',
    borderColor: '#aed581',
  },
  failureBadge: {
    backgroundColor: '#ffebee',
    borderColor: '#e57373',
  },
  skippedBadge: {
    backgroundColor: '#fff3e0',
    borderColor: '#ffb74d',
  },
  statusLabel: {
    fontSize: 10,
    color: '#999',
    marginBottom: 2,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1976d2',
  },
  currentItemContainer: {
    backgroundColor: '#E3F2FD',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#1976d2',
  },
  currentItemLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  currentItemTitle: {
    fontSize: 13,
    color: '#1976d2',
    fontWeight: '600',
  },
  timingRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  timingItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
  },
  timingLabel: {
    fontSize: 10,
    color: '#999',
    marginBottom: 2,
  },
  timingValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#212121',
  },
  recentItemsContainer: {
    marginBottom: 12,
    maxHeight: 120,
  },
  recentItemsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  recentItemsList: {
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    paddingHorizontal: 8,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statusIcon: {
    fontSize: 14,
    fontWeight: '700',
    width: 20,
  },
  recentItemTitle: {
    fontSize: 12,
    color: '#212121',
    flex: 1,
  },
  recentItemStatus: {
    fontSize: 10,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#1976d2',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  cancelButton: {
    backgroundColor: '#ffebee',
    flex: 0.4,
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#d32f2f',
  },
  statusMessage: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff3e0',
    borderRadius: 6,
    alignItems: 'center',
  },
  statusMessageText: {
    fontSize: 12,
    color: '#e65100',
    fontWeight: '500',
  },
});
