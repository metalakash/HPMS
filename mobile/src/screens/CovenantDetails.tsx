/**
 * Covenant Details - Deep-dive analysis of specific covenant
 */

import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, FlatList, Text } from 'react-native';
import { ScreenContainer, Header, Card, CardBody, Badge, Spacer } from '@/components';
import { LineChart, AreaChart } from '@/components/charts';

interface HistoryItem {
  date: string;
  value: number;
  status: 'compliant' | 'warning' | 'breached';
}

interface BreachRecord {
  id: string;
  startDate: string;
  endDate?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  status: 'active' | 'cured' | 'waived';
}

export const CovenantDetailsScreen = ({ navigation, route }: any) => {
  const { covenantId } = route.params || {};

  const [covenant] = useState({
    id: covenantId,
    name: 'Debt-to-Equity Ratio',
    category: 'Financial',
    status: 'compliant',
    currentValue: 1.8,
    maxAcceptable: 2.5,
    minAcceptable: 0.5,
    threshold: 2.5,
    unit: 'ratio',
    requirement: 'Must maintain debt-to-equity ratio below 2.5:1',
    description: 'Covenant from senior loan agreement to ensure debt sustainability',
    source: 'Loan Agreement',
    startDate: '2024-01-01',
    frequency: 'quarterly',
    lastChecked: '2026-09-15',
    nextDue: '2026-12-31',
  });

  const [history] = useState<HistoryItem[]>([
    { date: 'Q1 2026', value: 1.9, status: 'compliant' },
    { date: 'Q2 2026', value: 1.8, status: 'compliant' },
    { date: 'Q3 2026', value: 1.75, status: 'compliant' },
    { date: 'Q4 2026', value: 1.8, status: 'compliant' },
  ]);

  const [breaches] = useState<BreachRecord[]>([
    {
      id: '1',
      startDate: '2025-03-15',
      endDate: '2025-04-20',
      severity: 'high',
      reason: 'Unexpected debt issuance for equipment purchase',
      status: 'cured',
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

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '#F44336';
      case 'high':
        return '#FF5722';
      case 'medium':
        return '#FF9800';
      case 'low':
        return '#FFC107';
      default:
        return '#999';
    }
  };

  return (
    <ScreenContainer>
      <Header title="Covenant Details" onBack={() => navigation.goBack()} />
      <Spacer size="small" />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Covenant Overview */}
        <Text style={styles.sectionTitle}>Overview</Text>
        <Card>
          <CardBody>
            <View style={styles.covenantHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.covenantName}>{covenant.name}</Text>
                <Text style={styles.covenantCategory}>{covenant.category}</Text>
              </View>
              <Badge
                label="Compliant"
                variant="success"
              />
            </View>

            <Spacer size="small" />

            <Text style={styles.requirement}>{covenant.requirement}</Text>
            <Text style={styles.description}>{covenant.description}</Text>

            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Current Value</Text>
                <Text style={styles.infoValue}>{covenant.currentValue} {covenant.unit}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Threshold</Text>
                <Text style={styles.infoValue}>{covenant.threshold} {covenant.unit}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Source</Text>
                <Text style={styles.infoValue}>{covenant.source}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Frequency</Text>
                <Text style={styles.infoValue}>{covenant.frequency}</Text>
              </View>
            </View>
          </CardBody>
        </Card>

        <Spacer size="large" />

        {/* Current Status */}
        <Text style={styles.sectionTitle}>Current Status</Text>
        <Card>
          <CardBody>
            <View style={styles.statusContainer}>
              <View style={styles.statusValue}>
                <Text style={styles.statusLabel}>Current Value</Text>
                <Text style={styles.statusNumber}>{covenant.currentValue}</Text>
              </View>
              <View style={styles.statusBands}>
                <View style={[styles.band, { backgroundColor: '#4CAF50', height: 20 }]} />
                <Text style={styles.bandLabel}>Min: {covenant.minAcceptable}</Text>
                <View style={[styles.band, { backgroundColor: '#FFC107', height: 20 }]} />
                <Text style={styles.bandLabel}>Warning</Text>
                <View style={[styles.band, { backgroundColor: '#F44336', height: 20 }]} />
                <Text style={styles.bandLabel}>Max: {covenant.maxAcceptable}</Text>
              </View>
            </View>

            {/* Progress to threshold */}
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progress,
                  {
                    width: `${(covenant.currentValue / covenant.maxAcceptable) * 100}%`,
                    backgroundColor: '#4CAF50',
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {((covenant.currentValue / covenant.maxAcceptable) * 100).toFixed(0)}% of maximum
            </Text>
          </CardBody>
        </Card>

        <Spacer size="large" />

        {/* Historical Trend */}
        <Text style={styles.sectionTitle}>Historical Trend</Text>
        <Card>
          <CardBody>
            <LineChart
              data={history.map(h => ({ value: h.value, label: h.date }))}
              width={280}
              height={180}
              color="#2196F3"
            />
          </CardBody>
        </Card>

        <Spacer size="large" />

        {/* Breach History */}
        <Text style={styles.sectionTitle}>Breach History</Text>
        {breaches.length === 0 ? (
          <Card>
            <CardBody>
              <Text style={styles.emptyText}>No breaches recorded</Text>
            </CardBody>
          </Card>
        ) : (
          <FlatList
            data={breaches}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <Card style={styles.breachCard}>
                <CardBody>
                  <View style={styles.breachHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.breachPeriod}>
                        {item.startDate}
                        {item.endDate ? ` - ${item.endDate}` : ' - Ongoing'}
                      </Text>
                      <Text style={styles.breachReason}>{item.reason}</Text>
                    </View>
                    <Badge
                      label={item.severity.toUpperCase()}
                      variant={item.severity === 'critical' ? 'danger' : 'warning'}
                    />
                  </View>
                  <Text style={styles.breachStatus}>
                    Status: {item.status.toUpperCase()}
                  </Text>
                </CardBody>
              </Card>
            )}
          />
        )}

        <Spacer size="large" />

        {/* Next Due Date */}
        <Text style={styles.sectionTitle}>Next Verification</Text>
        <Card>
          <CardBody>
            <Text style={styles.dueDate}>Due: {covenant.nextDue}</Text>
            <Text style={styles.lastChecked}>Last checked: {covenant.lastChecked}</Text>
          </CardBody>
        </Card>

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
  covenantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  covenantName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  covenantCategory: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  requirement: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
    marginBottom: 12,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoItem: {
    flex: 1,
    minWidth: '45%',
  },
  infoLabel: {
    fontSize: 10,
    color: '#999',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  statusContainer: {
    marginBottom: 16,
  },
  statusValue: {
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  statusNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2196F3',
  },
  statusBands: {
    gap: 4,
  },
  band: {
    borderRadius: 2,
  },
  bandLabel: {
    fontSize: 10,
    color: '#999',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginVertical: 8,
    overflow: 'hidden',
  },
  progress: {
    height: 8,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 11,
    color: '#999',
  },
  emptyText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 16,
  },
  breachCard: {
    marginHorizontal: 12,
    marginVertical: 4,
  },
  breachHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  breachPeriod: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  breachReason: {
    fontSize: 11,
    color: '#666',
  },
  breachStatus: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  dueDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  lastChecked: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
});
