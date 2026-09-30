/**
 * Dependency Tracker Screen
 * Track dependencies between features and identify blocking issues
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from 'react-native';

interface Dependency {
  id: string;
  itemName: string;
  blocks: string;
  blockedBy: string;
  status: 'on-track' | 'at-risk' | 'blocked' | 'overdue';
  daysBlocked: number;
}

interface HealthScore {
  overall: number;
  onTime: number;
  blocked: number;
  overdue: number;
}

interface BlockingIssue {
  itemId: string;
  itemName: string;
  blockingCount: number;
  blockedByCount: number;
  daysBlocked: number;
}

export const DependencyTrackerScreen: React.FC = () => {
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [blockingIssues, setBlockingIssues] = useState<BlockingIssue[]>([]);
  const [healthScore, setHealthScore] = useState<HealthScore | null>(null);
  const [selectedTab, setSelectedTab] = useState<'blocking' | 'health' | 'critical'>('blocking');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDependencies();
  }, []);

  const loadDependencies = useCallback(async () => {
    setLoading(true);
    try {
      const mockDependencies: Dependency[] = [
        {
          id: 'dep-1',
          itemName: 'Inspection #45',
          blocks: 'Work Order #78',
          blockedBy: 'None',
          status: 'on-track',
          daysBlocked: 0,
        },
        {
          id: 'dep-2',
          itemName: 'Work Order #78',
          blocks: 'Compliance #12',
          blockedBy: 'Inspection #45',
          status: 'at-risk',
          daysBlocked: 1,
        },
        {
          id: 'dep-3',
          itemName: 'Work Order #79',
          blocks: 'Compliance #13',
          blockedBy: 'Inspection #46',
          status: 'blocked',
          daysBlocked: 3,
        },
      ];

      const mockBlockingIssues: BlockingIssue[] = [
        {
          itemId: 'insp-45',
          itemName: 'Inspection #45',
          blockingCount: 1,
          blockedByCount: 0,
          daysBlocked: 0,
        },
        {
          itemId: 'wo-78',
          itemName: 'Work Order #78',
          blockingCount: 1,
          blockedByCount: 1,
          daysBlocked: 1,
        },
      ];

      const mockHealthScore: HealthScore = {
        overall: 72,
        onTime: 85,
        blocked: 8,
        overdue: 7,
      };

      setDependencies(mockDependencies);
      setBlockingIssues(mockBlockingIssues);
      setHealthScore(mockHealthScore);
    } catch (error) {
      console.error('Error loading dependencies:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const getStatusColor = (status: string): string => {
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

  const getHealthColor = (score: number): string => {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#FF9800';
    return '#f44336';
  };

  const renderDependency = ({ item }: { item: Dependency }) => (
    <View style={styles.dependencyRow} testID={`dependency-${item.id}`}>
      <View style={styles.dependencyContent}>
        <View style={styles.depHeader}>
          <Text style={styles.itemName}>{item.itemName}</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(item.status) },
            ]}
          >
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>
        <View style={styles.depDetails}>
          <Text style={styles.depLabel}>Blocks: {item.blocks}</Text>
          {item.daysBlocked > 0 && (
            <Text style={styles.blockedLabel}>Blocked {item.daysBlocked}d</Text>
          )}
        </View>
      </View>
    </View>
  );

  const renderBlockingIssue = ({ item }: { item: BlockingIssue }) => (
    <View style={styles.blockingRow} testID={`blocking-issue-${item.itemId}`}>
      <View style={styles.blockingContent}>
        <Text style={styles.blockingName}>{item.itemName}</Text>
        <View style={styles.blockingStats}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Blocks</Text>
            <Text style={styles.statValue}>{item.blockingCount}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Blocked By</Text>
            <Text style={styles.statValue}>{item.blockedByCount}</Text>
          </View>
          {item.daysBlocked > 0 && (
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Days Blocked</Text>
              <Text style={[styles.statValue, { color: '#f44336' }]}>
                {item.daysBlocked}
              </Text>
            </View>
          )}
        </View>
      </View>
      <TouchableOpacity style={styles.escalateButton} testID={`escalate-${item.itemId}`}>
        <Text style={styles.escalateText}>Escalate</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="dependency-tracker-screen">
      <ScrollView style={styles.content}>
        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={styles.screenTitle}>Dependency Tracker</Text>
          <Text style={styles.subtitle}>Identify blocking issues and critical paths</Text>
        </View>

        {/* Tab Selection */}
        <View style={styles.tabsSection}>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'blocking' && styles.tabActive]}
            onPress={() => setSelectedTab('blocking')}
            testID="tab-blocking"
          >
            <Text
              style={[
                styles.tabText,
                selectedTab === 'blocking' && styles.tabTextActive,
              ]}
            >
              Blocking Issues
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'health' && styles.tabActive]}
            onPress={() => setSelectedTab('health')}
            testID="tab-health"
          >
            <Text
              style={[
                styles.tabText,
                selectedTab === 'health' && styles.tabTextActive,
              ]}
            >
              Health
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'critical' && styles.tabActive]}
            onPress={() => setSelectedTab('critical')}
            testID="tab-critical"
          >
            <Text
              style={[
                styles.tabText,
                selectedTab === 'critical' && styles.tabTextActive,
              ]}
            >
              Critical Path
            </Text>
          </TouchableOpacity>
        </View>

        {/* Blocking Issues Tab */}
        {selectedTab === 'blocking' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionLabel}>Blocking Issues ({blockingIssues.length})</Text>
            {blockingIssues.length > 0 ? (
              <FlatList
                data={blockingIssues}
                renderItem={renderBlockingIssue}
                keyExtractor={item => item.itemId}
                scrollEnabled={false}
                testID="blocking-issues-list"
              />
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No blocking issues detected</Text>
              </View>
            )}

            {/* Dependencies List */}
            <Text style={styles.sectionLabel}>Dependencies ({dependencies.length})</Text>
            <FlatList
              data={dependencies}
              renderItem={renderDependency}
              keyExtractor={item => item.id}
              scrollEnabled={false}
              testID="dependencies-list"
            />
          </View>
        )}

        {/* Health Tab */}
        {selectedTab === 'health' && healthScore && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionLabel}>Dependency Health Score</Text>
            <View style={styles.healthCard}>
              <View style={styles.healthScore}>
                <View
                  style={[
                    styles.healthCircle,
                    { backgroundColor: getHealthColor(healthScore.overall) },
                  ]}
                >
                  <Text style={styles.healthValue}>{healthScore.overall}%</Text>
                </View>
                <Text style={styles.healthLabel}>Overall Health</Text>
              </View>

              <View style={styles.healthMetrics}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{healthScore.onTime}%</Text>
                  <Text style={styles.metricLabel}>On-Time</Text>
                  <View style={[styles.metricIndicator, { backgroundColor: '#4CAF50' }]} />
                </View>
                <View style={styles.metricCard}>
                  <Text style={[styles.metricValue, { color: '#FF9800' }]}>
                    {healthScore.blocked}%
                  </Text>
                  <Text style={styles.metricLabel}>Blocked</Text>
                  <View style={[styles.metricIndicator, { backgroundColor: '#FF9800' }]} />
                </View>
                <View style={styles.metricCard}>
                  <Text style={[styles.metricValue, { color: '#f44336' }]}>
                    {healthScore.overdue}%
                  </Text>
                  <Text style={styles.metricLabel}>Overdue</Text>
                  <View style={[styles.metricIndicator, { backgroundColor: '#f44336' }]} />
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Critical Path Tab */}
        {selectedTab === 'critical' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionLabel}>Critical Path Analysis</Text>
            <View style={styles.criticalCard}>
              <View style={styles.criticalRow}>
                <Text style={styles.criticalLabel}>Longest Chain:</Text>
                <Text style={styles.criticalValue}>5 items (Inspection → WO → Compliance)</Text>
              </View>
              <View style={styles.criticalRow}>
                <Text style={styles.criticalLabel}>Bottleneck:</Text>
                <Text style={styles.criticalValue}>Work Order approval (2 days avg)</Text>
              </View>
              <View style={styles.criticalRow}>
                <Text style={styles.criticalLabel}>Risk Level:</Text>
                <View style={styles.riskBadge}>
                  <Text style={styles.riskText}>3 items stuck</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={styles.actionButton}
            testID="escalate-button"
          >
            <Text style={styles.actionButtonText}>🚨 Escalate Blocked Items</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary]}
            testID="create-parallel-button"
          >
            <Text style={styles.actionButtonSecondaryText}>+ Create Parallel WO</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    padding: 12,
  },
  headerSection: {
    marginBottom: 16,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
  },
  tabsSection: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#fff',
  },
  tabContent: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  dependencyRow: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  dependencyContent: {
    flex: 1,
  },
  depHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
  },
  depDetails: {
    flexDirection: 'row',
    gap: 12,
  },
  depLabel: {
    fontSize: 11,
    color: '#666',
  },
  blockedLabel: {
    fontSize: 11,
    color: '#f44336',
    fontWeight: '600',
  },
  blockingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  blockingContent: {
    flex: 1,
  },
  blockingName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  blockingStats: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: '#999',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  escalateButton: {
    backgroundColor: '#FF9800',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  escalateText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#999',
  },
  healthCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
  },
  healthScore: {
    alignItems: 'center',
    marginBottom: 20,
  },
  healthCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  healthValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  healthLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  healthMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 6,
    backgroundColor: '#f9f9f9',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 10,
    color: '#999',
    marginBottom: 6,
  },
  metricIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  criticalCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
  },
  criticalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  criticalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  criticalValue: {
    fontSize: 12,
    color: '#333',
  },
  riskBadge: {
    backgroundColor: '#ffe0e0',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  riskText: {
    fontSize: 10,
    color: '#f44336',
    fontWeight: '600',
  },
  actionsSection: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#FF9800',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  actionButtonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  actionButtonSecondaryText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
  },
});
