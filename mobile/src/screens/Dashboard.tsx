/**
 * Dashboard Screen - Portfolio overview with KPIs and project list
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import {
  ScreenContainer,
  Header,
  Card,
  Badge,
  ListItem,
  EmptyState,
  ErrorState,
  Spinner,
} from '@/components';

import useAppStore from '@/store/app.store';

interface PortfolioMetrics {
  totalProjects: number;
  totalCapacityMw: number;
  activeProjects: number;
  averageProgress: number;
}

interface Project {
  id: string;
  name: string;
  code: string;
  capacityMw: number;
  stage: 'feasibility' | 'construction' | 'operation';
  pipelineStatus: 'active' | 'on-hold' | 'completed';
}

const DashboardScreen: React.FC = ({ navigation }: any) => {
  const { isOnline, isDarkMode } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<PortfolioMetrics>({
    totalProjects: 0,
    totalCapacityMw: 0,
    activeProjects: 0,
    averageProgress: 0,
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Fetch portfolio metrics
  const fetchMetrics = async () => {
    try {
      setError(null);
      // Mock data - replace with actual API call
      const mockMetrics: PortfolioMetrics = {
        totalProjects: 12,
        totalCapacityMw: 450,
        activeProjects: 8,
        averageProgress: 65,
      };
      setMetrics(mockMetrics);
    } catch (err: any) {
      setError(err.message || 'Failed to load metrics');
    }
  };

  // Fetch projects list
  const fetchProjects = async (pageNum: number = 1) => {
    try {
      setError(null);
      // Mock data - replace with actual API call
      const mockProjects: Project[] = [
        {
          id: '1',
          name: 'Kali Gandaki A',
          code: 'KGA-01',
          capacityMw: 144,
          stage: 'operation',
          pipelineStatus: 'active',
        },
        {
          id: '2',
          name: 'Chisapani',
          code: 'CSP-02',
          capacityMw: 3000,
          stage: 'construction',
          pipelineStatus: 'active',
        },
        {
          id: '3',
          name: 'Upper Marsyandi',
          code: 'UMD-03',
          capacityMw: 600,
          stage: 'construction',
          pipelineStatus: 'active',
        },
        {
          id: '4',
          name: 'Lower Arun III',
          code: 'LAR-04',
          capacityMw: 213,
          stage: 'operation',
          pipelineStatus: 'active',
        },
      ];

      if (pageNum === 1) {
        setProjects(mockProjects);
      } else {
        setProjects([...projects, ...mockProjects]);
      }

      setHasMore(mockProjects.length === 10);
    } catch (err: any) {
      setError(err.message || 'Failed to load projects');
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchMetrics(), fetchProjects(1)]);
      setLoading(false);
    };

    loadData();
  }, []);

  // Refresh on screen focus
  useFocusEffect(
    React.useCallback(() => {
      fetchMetrics();
      fetchProjects(1);
    }, [])
  );

  // Handle refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchMetrics(), fetchProjects(1)]);
    setRefreshing(false);
  };

  // Handle load more
  const onEndReached = () => {
    if (hasMore && !loading) {
      setPage(page + 1);
      fetchProjects(page + 1);
    }
  };

  // Get stage badge color
  const getStageBadgeColor = (
    stage: 'feasibility' | 'construction' | 'operation'
  ) => {
    switch (stage) {
      case 'operation':
        return 'success';
      case 'construction':
        return 'warning';
      case 'feasibility':
        return 'primary';
      default:
        return 'neutral';
    }
  };

  if (error && projects.length === 0) {
    return (
      <ScreenContainer>
        <Header title="Projects" />
        <ErrorState
          title="Failed to Load"
          message={error}
          onRetry={() => {
            fetchMetrics();
            fetchProjects(1);
          }}
        />
      </ScreenContainer>
    );
  }

  if (loading && projects.length === 0) {
    return (
      <ScreenContainer>
        <Header title="Projects" />
        <View style={styles.centerContainer}>
          <Spinner />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable={false}>
      <Header
        title="Projects"
        subtitle={`${metrics.totalProjects} total`}
      />

      {/* Online Status Indicator */}
      {!isOnline && (
        <View style={styles.offlineBar}>
          <Text style={styles.offlineText}>📡 Offline mode</Text>
        </View>
      )}

      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDarkMode ? '#fff' : '#1976d2'}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerSection}>
            {/* KPI Cards */}
            <View style={styles.kpiGrid}>
              <Card style={styles.kpiCard}>
                <Text style={styles.kpiValue}>{metrics.totalProjects}</Text>
                <Text style={styles.kpiLabel}>Total Projects</Text>
              </Card>
              <Card style={styles.kpiCard}>
                <Text style={styles.kpiValue}>{metrics.totalCapacityMw}</Text>
                <Text style={styles.kpiLabel}>MW Capacity</Text>
              </Card>
              <Card style={styles.kpiCard}>
                <Text style={styles.kpiValue}>{metrics.activeProjects}</Text>
                <Text style={styles.kpiLabel}>Active</Text>
              </Card>
              <Card style={styles.kpiCard}>
                <Text style={styles.kpiValue}>{metrics.averageProgress}%</Text>
                <Text style={styles.kpiLabel}>Avg Progress</Text>
              </Card>
            </View>

            {/* Projects Header */}
            <View style={styles.projectsHeader}>
              <Text style={styles.projectsTitle}>Recent Projects</Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.projectItem}>
            <ListItem
              title={item.name}
              subtitle={`${item.code} • ${item.capacityMw} MW`}
              rightContent={
                <Badge
                  label={item.stage}
                  variant={getStageBadgeColor(item.stage)}
                  size="sm"
                />
              }
              onPress={() =>
                navigation.navigate('ProjectDetail', { projectId: item.id })
              }
              divider={false}
            />
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              title="No Projects"
              description="No projects found. Try refreshing."
              actionLabel="Refresh"
              onAction={onRefresh}
            />
          ) : null
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.1}
        ListFooterComponent={
          hasMore ? (
            <View style={styles.centerContainer}>
              <Spinner size="small" />
            </View>
          ) : null
        }
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  offlineBar: {
    backgroundColor: '#ff9800',
    paddingVertical: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  offlineText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  headerSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  kpiCard: {
    width: '48%',
    paddingVertical: 16,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1976d2',
    marginBottom: 4,
  },
  kpiLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  projectsHeader: {
    marginTop: 8,
    marginBottom: 12,
  },
  projectsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  projectItem: {
    marginHorizontal: 16,
    marginVertical: 2,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
});

export default DashboardScreen;
