/**
 * Project Stats Component
 * Displays project statistics in grid format
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';

interface Stats {
  records: number;
  inspections: number;
  workOrders: number;
  complianceIssues: number;
}

interface ProjectStatsProps {
  stats: Stats;
  isCompact?: boolean;
  previousStats?: Stats;
}

export const ProjectStats: React.FC<ProjectStatsProps> = ({
  stats,
  isCompact = false,
  previousStats,
}) => {
  const calculateTrend = (current: number, previous?: number): string | null => {
    if (!previous) return null;
    const diff = current - previous;
    if (diff === 0) return '→';
    return diff > 0 ? `↑ +${diff}` : `↓ ${diff}`;
  };

  const getTrendColor = (previous?: number, current?: number): string => {
    if (!previous || !current) return '#999';
    const diff = current - previous;
    if (diff > 0) return '#4CAF50';
    if (diff < 0) return '#F44336';
    return '#999';
  };

  const renderStatBox = (
    label: string,
    value: number,
    previous?: number,
    color?: string
  ) => {
    const trend = calculateTrend(value, previous);
    const trendColor = getTrendColor(previous, value);

    return (
      <View
        key={label}
        style={[styles.statBox, isCompact && styles.statBoxCompact]}
        testID={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}
      >
        <Text style={[styles.statValue, { color: color || '#2196F3' }]}>
          {value}
        </Text>
        <Text style={styles.statLabel}>{label}</Text>
        {trend && (
          <Text style={[styles.statTrend, { color: trendColor }]}>
            {trend}
          </Text>
        )}
      </View>
    );
  };

  return (
    <View
      style={[styles.container, isCompact && styles.containerCompact]}
      testID="project-stats"
    >
      {isCompact ? (
        // Compact 2-column layout
        <View style={styles.compactGrid}>
          <View style={styles.compactColumn}>
            {renderStatBox('Records', stats.records, previousStats?.records)}
            {renderStatBox(
              'Work Orders',
              stats.workOrders,
              previousStats?.workOrders
            )}
          </View>
          <View style={styles.compactColumn}>
            {renderStatBox(
              'Inspections',
              stats.inspections,
              previousStats?.inspections
            )}
            {renderStatBox(
              'Compliance',
              stats.complianceIssues,
              previousStats?.complianceIssues
            )}
          </View>
        </View>
      ) : (
        // Full 4-column layout
        <View style={styles.fullGrid}>
          {renderStatBox('Records', stats.records, previousStats?.records)}
          {renderStatBox(
            'Inspections',
            stats.inspections,
            previousStats?.inspections
          )}
          {renderStatBox(
            'Work Orders',
            stats.workOrders,
            previousStats?.workOrders
          )}
          {renderStatBox(
            'Compliance',
            stats.complianceIssues,
            previousStats?.complianceIssues
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  containerCompact: {
    paddingVertical: 8,
  },
  fullGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  compactGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  compactColumn: {
    flex: 1,
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statBoxCompact: {
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    textAlign: 'center',
  },
  statTrend: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
});
