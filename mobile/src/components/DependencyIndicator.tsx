/**
 * Dependency Indicator Component
 * Visual indicator showing dependency status and blocking status
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface DependencyIndicatorProps {
  status: 'on-track' | 'at-risk' | 'blocked' | 'overdue';
  blockedByCount: number;
  blocksCount: number;
  daysBlocked?: number;
}

export const DependencyIndicator: React.FC<DependencyIndicatorProps> = ({
  status,
  blockedByCount,
  blocksCount,
  daysBlocked,
}) => {
  const getStatusColor = (): string => {
    switch (status) {
      case 'on-track':
        return '#4CAF50';
      case 'at-risk':
        return '#FF9800';
      case 'blocked':
        return '#f44336';
      case 'overdue':
        return '#d32f2f';
      default:
        return '#999';
    }
  };

  const getStatusText = (): string => {
    switch (status) {
      case 'on-track':
        return '✓ On Track';
      case 'at-risk':
        return '⚠ At Risk';
      case 'blocked':
        return '⛔ Blocked';
      case 'overdue':
        return '🔴 Overdue';
      default:
        return 'Unknown';
    }
  };

  return (
    <View style={styles.container} testID={`dependency-indicator-${status}`}>
      <View
        style={[
          styles.statusDot,
          {
            backgroundColor: getStatusColor(),
          },
        ]}
      />
      <View style={styles.content}>
        <Text style={styles.statusText}>{getStatusText()}</Text>
        <View style={styles.details}>
          {blocksCount > 0 && (
            <Text style={styles.detailText}>Blocks {blocksCount}</Text>
          )}
          {blockedByCount > 0 && (
            <Text style={styles.detailText}>Blocked by {blockedByCount}</Text>
          )}
          {daysBlocked && daysBlocked > 0 && (
            <Text style={[styles.detailText, styles.blockedText]}>
              {daysBlocked}d blocked
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  content: {
    flex: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  details: {
    flexDirection: 'row',
    gap: 8,
  },
  detailText: {
    fontSize: 10,
    color: '#666',
  },
  blockedText: {
    color: '#f44336',
    fontWeight: '600',
  },
});
