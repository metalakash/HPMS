/**
 * Audit Stats Screen
 * Audit statistics and analytics dashboard
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from 'react-native';

interface AuditStats {
  totalEvents: number;
  creates: number;
  updates: number;
  deletes: number;
  exports: number;
  imports: number;
  rollbacks: number;
}

interface UserActivity {
  userEmail: string;
  actionCount: number;
  lastActive: string;
}

interface DailyCount {
  date: string;
  count: number;
}

export const AuditStatsScreen: React.FC = () => {
  const [period, setPeriod] = useState<'week' | 'month' | 'year' | 'custom'>('month');
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [topUsers, setTopUsers] = useState<UserActivity[]>([]);
  const [timelineData, setTimelineData] = useState<DailyCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [period]);

  const loadStats = async () => {
    setLoading(true);
    try {
      // Simulate API call
      const mockStats: AuditStats = {
        totalEvents: 845,
        creates: 234,
        updates: 389,
        deletes: 45,
        exports: 98,
        imports: 65,
        rollbacks: 14,
      };

      const mockTopUsers: UserActivity[] = [
        {
          userEmail: 'akash@example.com',
          actionCount: 245,
          lastActive: new Date().toISOString(),
        },
        {
          userEmail: 'john@example.com',
          actionCount: 128,
          lastActive: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          userEmail: 'sarah@example.com',
          actionCount: 89,
          lastActive: new Date(Date.now() - 7200000).toISOString(),
        },
      ];

      const mockTimeline: DailyCount[] = Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        count: Math.floor(Math.random() * 50) + 10,
      }));

      setStats(mockStats);
      setTopUsers(mockTopUsers);
      setTimelineData(mockTimeline);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionPercentage = (count: number, total: number): number => {
    return total === 0 ? 0 : Math.round((count / total) * 100);
  };

  const formatTimeAgo = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const formatTrend = (): string => {
    return `↑ 12% from last period`;
  };

  const renderStatCard = (label: string, value: number, trend?: string) => (
    <View style={styles.statCard} testID="stat-card">
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {trend && <Text style={styles.statTrend}>{trend}</Text>}
    </View>
  );

  const renderUserRow = ({ item }: { item: UserActivity }) => (
    <View style={styles.userRow} testID="user-activity-row">
      <View style={styles.userInfo}>
        <Text style={styles.userEmail}>{item.userEmail}</Text>
        <Text style={styles.userLastActive}>
          Last active: {formatTimeAgo(item.lastActive)}
        </Text>
      </View>
      <View style={styles.userActions}>
        <Text style={styles.userActionCount}>{item.actionCount}</Text>
        <Text style={styles.userActionLabel}>actions</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Failed to load statistics</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="audit-stats-screen">
      <ScrollView style={styles.content}>
        {/* Period Selector */}
        <View style={styles.periodSelector}>
          <TouchableOpacity
            style={[styles.periodButton, period === 'week' && styles.periodButtonActive]}
            onPress={() => setPeriod('week')}
            testID="period-week"
          >
            <Text
              style={[
                styles.periodButtonText,
                period === 'week' && styles.periodButtonTextActive,
              ]}
            >
              Week
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodButton, period === 'month' && styles.periodButtonActive]}
            onPress={() => setPeriod('month')}
            testID="period-month"
          >
            <Text
              style={[
                styles.periodButtonText,
                period === 'month' && styles.periodButtonTextActive,
              ]}
            >
              Month
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodButton, period === 'year' && styles.periodButtonActive]}
            onPress={() => setPeriod('year')}
            testID="period-year"
          >
            <Text
              style={[
                styles.periodButtonText,
                period === 'year' && styles.periodButtonTextActive,
              ]}
            >
              Year
            </Text>
          </TouchableOpacity>
        </View>

        {/* Summary Statistics */}
        <View style={styles.summarySection}>
          <View style={styles.statCardsRow}>
            {renderStatCard('Total Events', stats.totalEvents, formatTrend())}
          </View>
          <View style={styles.statCardsRow2}>
            {renderStatCard('Creates', stats.creates)}
            {renderStatCard('Updates', stats.updates)}
          </View>
          <View style={styles.statCardsRow2}>
            {renderStatCard('Deletes', stats.deletes)}
            {renderStatCard('Exports', stats.exports)}
          </View>
        </View>

        {/* Actions by Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions by Type</Text>
          <View style={styles.chartContainer}>
            <View style={styles.chartRow}>
              <View style={styles.chartLabel}>
                <Text style={styles.chartLabelText}>CREATE</Text>
              </View>
              <View style={[styles.chartBar, { width: `${getActionPercentage(stats.creates, stats.totalEvents)}%` }]} />
              <Text style={styles.chartValue}>{stats.creates}</Text>
            </View>
            <View style={styles.chartRow}>
              <View style={styles.chartLabel}>
                <Text style={styles.chartLabelText}>UPDATE</Text>
              </View>
              <View style={[styles.chartBar, { width: `${getActionPercentage(stats.updates, stats.totalEvents)}%` }]} />
              <Text style={styles.chartValue}>{stats.updates}</Text>
            </View>
            <View style={styles.chartRow}>
              <View style={styles.chartLabel}>
                <Text style={styles.chartLabelText}>DELETE</Text>
              </View>
              <View style={[styles.chartBar, { width: `${getActionPercentage(stats.deletes, stats.totalEvents)}%` }]} />
              <Text style={styles.chartValue}>{stats.deletes}</Text>
            </View>
            <View style={styles.chartRow}>
              <View style={styles.chartLabel}>
                <Text style={styles.chartLabelText}>EXPORT</Text>
              </View>
              <View style={[styles.chartBar, { width: `${getActionPercentage(stats.exports, stats.totalEvents)}%` }]} />
              <Text style={styles.chartValue}>{stats.exports}</Text>
            </View>
            <View style={styles.chartRow}>
              <View style={styles.chartLabel}>
                <Text style={styles.chartLabelText}>IMPORT</Text>
              </View>
              <View style={[styles.chartBar, { width: `${getActionPercentage(stats.imports, stats.totalEvents)}%` }]} />
              <Text style={styles.chartValue}>{stats.imports}</Text>
            </View>
            <View style={styles.chartRow}>
              <View style={styles.chartLabel}>
                <Text style={styles.chartLabelText}>ROLLBACK</Text>
              </View>
              <View style={[styles.chartBar, { width: `${getActionPercentage(stats.rollbacks, stats.totalEvents)}%` }]} />
              <Text style={styles.chartValue}>{stats.rollbacks}</Text>
            </View>
          </View>
        </View>

        {/* Feature Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Feature Activity</Text>
          <View style={styles.featureActivity}>
            <View style={styles.featureRow}>
              <Text style={styles.featureLabel}>Projects</Text>
              <View style={styles.featureBarContainer}>
                <View style={[styles.featureBar, { width: '70%' }]} />
              </View>
              <Text style={styles.featureCount}>245</Text>
            </View>
            <View style={styles.featureRow}>
              <Text style={styles.featureLabel}>Inspections</Text>
              <View style={styles.featureBarContainer}>
                <View style={[styles.featureBar, { width: '85%' }]} />
              </View>
              <Text style={styles.featureCount}>310</Text>
            </View>
            <View style={styles.featureRow}>
              <Text style={styles.featureLabel}>Work Orders</Text>
              <View style={styles.featureBarContainer}>
                <View style={[styles.featureBar, { width: '55%' }]} />
              </View>
              <Text style={styles.featureCount}>195</Text>
            </View>
            <View style={styles.featureRow}>
              <Text style={styles.featureLabel}>Compliance</Text>
              <View style={styles.featureBarContainer}>
                <View style={[styles.featureBar, { width: '40%' }]} />
              </View>
              <Text style={styles.featureCount}>145</Text>
            </View>
          </View>
        </View>

        {/* Top Users */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Users</Text>
          <View style={styles.topUsersContainer}>
            <View style={styles.leaderboardHeader}>
              <Text style={styles.leaderboardHeaderText}>Rank</Text>
              <Text style={styles.leaderboardHeaderText}>User</Text>
              <Text style={styles.leaderboardHeaderText}>Actions</Text>
            </View>
            <FlatList
              data={topUsers}
              renderItem={({ item, index }) => (
                <View key={item.userEmail} style={styles.leaderboardRow} testID="leaderboard-row">
                  <Text style={styles.leaderboardRank}>{index + 1}</Text>
                  <View style={styles.leaderboardUser}>
                    <Text style={styles.leaderboardUserName}>{item.userEmail}</Text>
                    <Text style={styles.leaderboardUserTime}>
                      {formatTimeAgo(item.lastActive)}
                    </Text>
                  </View>
                  <Text style={styles.leaderboardScore}>{item.actionCount}</Text>
                </View>
              )}
              scrollEnabled={false}
            />
          </View>
        </View>

        {/* Activity Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity Timeline</Text>
          <View style={styles.timelineContainer}>
            <View style={styles.sparkline}>
              {timelineData.map((point, index) => (
                <View
                  key={index}
                  style={[
                    styles.sparklineBar,
                    {
                      height: `${(point.count / Math.max(...timelineData.map(d => d.count))) * 100}%`,
                    },
                  ]}
                  testID="timeline-bar"
                />
              ))}
            </View>
            <View style={styles.timelineLabels}>
              <Text style={styles.timelineLabel}>
                {timelineData[timelineData.length - 1]?.date}
              </Text>
              <Text style={styles.timelineLabel}>
                {timelineData[0]?.date}
              </Text>
            </View>
          </View>
        </View>

        {/* Export Button */}
        <TouchableOpacity style={styles.exportButton} testID="export-stats-button">
          <Text style={styles.exportButtonText}>📊 Export Analytics</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  periodSelector: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  periodButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  periodButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  periodButtonTextActive: {
    color: '#fff',
  },
  summarySection: {
    marginBottom: 16,
  },
  statCardsRow: {
    marginBottom: 8,
  },
  statCardsRow2: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statTrend: {
    fontSize: 11,
    color: '#4CAF50',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  chartLabel: {
    width: 60,
  },
  chartLabelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  chartBar: {
    flex: 1,
    height: 24,
    backgroundColor: '#2196F3',
    borderRadius: 4,
  },
  chartValue: {
    width: 40,
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    textAlign: 'right',
  },
  featureActivity: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  featureLabel: {
    width: 80,
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  featureBarContainer: {
    flex: 1,
    height: 20,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  featureBar: {
    height: '100%',
    backgroundColor: '#FF9800',
  },
  featureCount: {
    width: 40,
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    textAlign: 'right',
  },
  topUsersContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
  },
  leaderboardHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  leaderboardHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  leaderboardRank: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#2196F3',
    width: 30,
  },
  leaderboardUser: {
    flex: 1,
  },
  leaderboardUserName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  leaderboardUserTime: {
    fontSize: 11,
    color: '#999',
  },
  leaderboardScore: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  userInfo: {
    flex: 1,
  },
  userEmail: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  userLastActive: {
    fontSize: 11,
    color: '#999',
  },
  userActions: {
    alignItems: 'flex-end',
  },
  userActionCount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  userActionLabel: {
    fontSize: 10,
    color: '#999',
  },
  timelineContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    minHeight: 120,
  },
  sparkline: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 80,
    gap: 2,
    marginBottom: 12,
  },
  sparklineBar: {
    flex: 1,
    backgroundColor: '#4CAF50',
    borderRadius: 2,
    minHeight: 4,
  },
  timelineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timelineLabel: {
    fontSize: 11,
    color: '#999',
  },
  exportButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
