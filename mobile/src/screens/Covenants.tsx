/**
 * Covenants Dashboard - Covenant compliance overview and monitoring
 */

import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, FlatList, Text } from 'react-native';
import { ScreenContainer, Header, Card, CardBody, Badge, Spacer, Button } from '@/components';
import { GaugeChart } from '@/components/charts';

interface CovenantItem {
  id: string;
  name: string;
  category: string;
  status: 'compliant' | 'warning' | 'breached' | 'pending';
  currentValue: number;
  threshold: number;
  unit: string;
  project: string;
}

interface CovenantSummary {
  total: number;
  compliant: number;
  warning: number;
  breached: number;
  score: number;
}

export const CovenantsScreen = ({ navigation }: any) => {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [summary] = useState<CovenantSummary>({
    total: 24,
    compliant: 16,
    warning: 6,
    breached: 2,
    score: 78,
  });

  const [covenants] = useState<CovenantItem[]>([
    {
      id: '1',
      name: 'Debt-to-Equity Ratio',
      category: 'financial',
      status: 'compliant',
      currentValue: 1.8,
      threshold: 2.5,
      unit: 'ratio',
      project: 'Hydro Alpha',
    },
    {
      id: '2',
      name: 'Minimum Efficiency',
      category: 'operational',
      status: 'compliant',
      currentValue: 89,
      threshold: 85,
      unit: '%',
      project: 'Hydro Beta',
    },
    {
      id: '3',
      name: 'Annual Report Filing',
      category: 'reporting',
      status: 'warning',
      currentValue: 45,
      threshold: 30,
      unit: 'days until due',
      project: 'Hydro Alpha',
    },
    {
      id: '4',
      name: 'Water Flow Rate',
      category: 'environmental',
      status: 'breached',
      currentValue: 420,
      threshold: 500,
      unit: 'cubic meters/sec',
      project: 'Hydro Gamma',
    },
    {
      id: '5',
      name: 'Current Ratio',
      category: 'financial',
      status: 'warning',
      currentValue: 1.2,
      threshold: 1.5,
      unit: 'ratio',
      project: 'Hydro Delta',
    },
    {
      id: '6',
      name: 'Equipment Maintenance',
      category: 'maintenance',
      status: 'compliant',
      currentValue: 100,
      threshold: 95,
      unit: '%',
      project: 'Hydro Beta',
    },
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant':
        return '#4CAF50';
      case 'warning':
        return '#FF9800';
      case 'breached':
        return '#F44336';
      default:
        return '#999';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'compliant':
        return 'Compliant';
      case 'warning':
        return 'Warning';
      case 'breached':
        return 'Breached';
      default:
        return 'Pending';
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'compliant':
        return 'success';
      case 'warning':
        return 'warning';
      case 'breached':
        return 'danger';
      default:
        return 'secondary';
    }
  };

  const filteredCovenants =
    selectedFilter === 'all'
      ? covenants
      : covenants.filter(c => c.status === selectedFilter);

  const handleCategoryFilter = (filter: string) => {
    setSelectedFilter(filter);
  };

  return (
    <ScreenContainer>
      <Header title="Covenant Compliance" subtitle="Monitor Contractual Obligations" />
      <Spacer size="small" />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Compliance Score Gauge */}
        <Text style={styles.sectionTitle}>Overall Compliance Score</Text>
        <Card>
          <CardBody style={styles.gaugeContainer}>
            <GaugeChart
              value={summary.score}
              maxValue={100}
              color="#2196F3"
              width={240}
              height={180}
              unit="%"
            />
            <Text style={styles.scoreLabel}>
              {summary.compliant}/{summary.total} covenants compliant
            </Text>
          </CardBody>
        </Card>

        <Spacer size="large" />

        {/* Summary Stats */}
        <Text style={styles.sectionTitle}>Summary</Text>
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <CardBody style={styles.statContent}>
              <Text style={styles.statNumber}>{summary.compliant}</Text>
              <Text style={styles.statLabel}>Compliant</Text>
            </CardBody>
          </Card>
          <Card style={styles.statCard}>
            <CardBody style={styles.statContent}>
              <Text style={[styles.statNumber, { color: '#FF9800' }]}>
                {summary.warning}
              </Text>
              <Text style={styles.statLabel}>Warning</Text>
            </CardBody>
          </Card>
          <Card style={styles.statCard}>
            <CardBody style={styles.statContent}>
              <Text style={[styles.statNumber, { color: '#F44336' }]}>
                {summary.breached}
              </Text>
              <Text style={styles.statLabel}>Breached</Text>
            </CardBody>
          </Card>
        </View>

        <Spacer size="large" />

        {/* Filter Buttons */}
        <Text style={styles.sectionTitle}>Filter by Status</Text>
        <View style={styles.filterButtons}>
          <Button
            title="All"
            onPress={() => handleCategoryFilter('all')}
            variant={selectedFilter === 'all' ? 'primary' : 'secondary'}
            size="small"
            style={styles.filterButton}
          />
          <Button
            title="✓ Compliant"
            onPress={() => handleCategoryFilter('compliant')}
            variant={selectedFilter === 'compliant' ? 'primary' : 'secondary'}
            size="small"
            style={styles.filterButton}
          />
          <Button
            title="⚠ Warning"
            onPress={() => handleCategoryFilter('warning')}
            variant={selectedFilter === 'warning' ? 'primary' : 'secondary'}
            size="small"
            style={styles.filterButton}
          />
          <Button
            title="✕ Breached"
            onPress={() => handleCategoryFilter('breached')}
            variant={selectedFilter === 'breached' ? 'primary' : 'secondary'}
            size="small"
            style={styles.filterButton}
          />
        </View>

        <Spacer size="large" />

        {/* Covenants List */}
        <Text style={styles.sectionTitle}>
          Covenants ({filteredCovenants.length})
        </Text>
        <FlatList
          data={filteredCovenants}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <Card
              onPress={() => navigation.navigate('CovenantDetails', { covenantId: item.id })}
              testID={`covenant-${item.id}`}
            >
              <CardBody>
                <View style={styles.covenantRow}>
                  <View style={styles.covenantInfo}>
                    <Text style={styles.covenantName}>{item.name}</Text>
                    <Text style={styles.covenantCategory}>{item.category}</Text>
                    <Text style={styles.covenantProject}>{item.project}</Text>
                  </View>
                  <View style={styles.covenantValue}>
                    <Text style={styles.valueNumber}>
                      {item.currentValue} {item.unit}
                    </Text>
                    <Text style={styles.valueThreshold}>
                      Threshold: {item.threshold}
                    </Text>
                  </View>
                  <Badge
                    label={getStatusLabel(item.status)}
                    variant={getStatusVariant(item.status)}
                  />
                </View>

                {/* Progress bar */}
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progress,
                      {
                        width: `${Math.min((item.currentValue / item.threshold) * 100, 100)}%`,
                        backgroundColor: getStatusColor(item.status),
                      },
                    ]}
                  />
                </View>
              </CardBody>
            </Card>
          )}
        />

        <Spacer size="large" />

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Actions</Text>
        <View style={styles.actionsContainer}>
          <Button
            title="Breaches"
            onPress={() => navigation.navigate('BreachManagement')}
            variant="secondary"
            size="small"
            style={styles.actionButton}
          />
          <Button
            title="Monitoring"
            onPress={() => navigation.navigate('ComplianceMonitoring')}
            variant="secondary"
            size="small"
            style={styles.actionButton}
          />
          <Button
            title="Reports"
            onPress={() => navigation.navigate('ComplianceReports')}
            variant="secondary"
            size="small"
            style={styles.actionButton}
          />
        </View>

        <Spacer size="large" />
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  gaugeContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  scoreLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    gap: 8,
  },
  statCard: {
    flex: 1,
  },
  statContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4CAF50',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    minWidth: '45%',
  },
  covenantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  covenantInfo: {
    flex: 1,
  },
  covenantName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  covenantCategory: {
    fontSize: 10,
    color: '#999',
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  covenantProject: {
    fontSize: 10,
    color: '#666',
  },
  covenantValue: {
    alignItems: 'flex-end',
  },
  valueNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 2,
  },
  valueThreshold: {
    fontSize: 10,
    color: '#999',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progress: {
    height: 4,
    borderRadius: 2,
  },
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    gap: 8,
  },
  actionButton: {
    flex: 1,
  },
});
