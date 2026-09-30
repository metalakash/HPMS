/**
 * Efficiency Analytics - System efficiency metrics and performance
 */

import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, FlatList, Text } from 'react-native';
import { ScreenContainer, Header, Card, CardBody, Badge, Spacer } from '@/components';
import { LineChart, GaugeChart, RadarChart } from '@/components/charts';

interface EfficiencyMetric {
  id: string;
  month: string;
  efficiency: number;
  target: number;
}

interface AnomalyAlert {
  id: string;
  date: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export const EfficiencyAnalyticsScreen = ({ navigation }: any) => {
  const [metrics] = useState<EfficiencyMetric[]>([
    { id: '1', month: 'Jan', efficiency: 85, target: 90 },
    { id: '2', month: 'Feb', efficiency: 87, target: 90 },
    { id: '3', month: 'Mar', efficiency: 86, target: 90 },
    { id: '4', month: 'Apr', efficiency: 88, target: 90 },
    { id: '5', month: 'May', efficiency: 89, target: 90 },
    { id: '6', month: 'Jun', efficiency: 90, target: 90 },
  ]);

  const [anomalies] = useState<AnomalyAlert[]>([
    { id: '1', date: '2026-06-15', message: 'Efficiency drop below 80%', severity: 'warning' },
    { id: '2', date: '2026-06-10', message: 'Seasonal maintenance detected', severity: 'info' },
    { id: '3', date: '2026-06-05', message: 'Performance recovered to target', severity: 'info' },
  ]);

  const [radarData] = useState([
    { label: 'Capacity', value: 92 },
    { label: 'Output', value: 88 },
    { label: 'Reliability', value: 95 },
    { label: 'Uptime', value: 98 },
    { label: 'Efficiency', value: 90 },
  ]);

  const currentEfficiency = 90;
  const avgEfficiency = Math.round(metrics.reduce((sum, m) => sum + m.efficiency, 0) / metrics.length);

  return (
    <ScreenContainer>
      <Header title="Efficiency Analytics" onBack={() => navigation.goBack()} />
      <Spacer size="small" />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Current Efficiency Gauge */}
        <Text style={styles.sectionTitle}>Current Efficiency</Text>
        <Card>
          <CardBody style={styles.gaugeContainer}>
            <GaugeChart
              value={currentEfficiency}
              maxValue={100}
              color="#2196F3"
              width={240}
              height={200}
              unit="%"
            />
          </CardBody>
        </Card>

        <Spacer size="medium" />

        {/* Summary Stats */}
        <Text style={styles.sectionTitle}>Performance Summary</Text>
        <View style={styles.statsContainer}>
          <Card style={styles.statCard}>
            <CardBody>
              <Text style={styles.statLabel}>Average</Text>
              <Text style={styles.statValue}>{avgEfficiency}%</Text>
            </CardBody>
          </Card>
          <Card style={styles.statCard}>
            <CardBody>
              <Text style={styles.statLabel}>Target</Text>
              <Text style={styles.statValue}>90%</Text>
            </CardBody>
          </Card>
          <Card style={styles.statCard}>
            <CardBody>
              <Text style={styles.statLabel}>Variance</Text>
              <Text style={[styles.statValue, { color: currentEfficiency >= 90 ? '#4CAF50' : '#FF9800' }]}>
                {(currentEfficiency - 90).toFixed(1)}%
              </Text>
            </CardBody>
          </Card>
        </View>

        <Spacer size="large" />

        {/* Efficiency Trend */}
        <Text style={styles.sectionTitle}>Efficiency Trend (%)</Text>
        <Card>
          <CardBody>
            <LineChart
              data={metrics.map(m => ({ value: m.efficiency, label: m.month }))}
              width={280}
              height={180}
              color="#2196F3"
            />
          </CardBody>
        </Card>

        <Spacer size="large" />

        {/* Multi-Axis Performance */}
        <Text style={styles.sectionTitle}>System Performance Profile</Text>
        <Card>
          <CardBody style={styles.radarContainer}>
            <RadarChart
              data={radarData}
              width={260}
              height={260}
              color="#2196F3"
              maxValue={100}
            />
          </CardBody>
        </Card>

        <Spacer size="large" />

        {/* Anomaly Alerts */}
        <Text style={styles.sectionTitle}>Performance Alerts</Text>
        <FlatList
          data={anomalies}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <Card style={styles.alertCard}>
              <CardBody>
                <View style={styles.alertRow}>
                  <View style={styles.alertContent}>
                    <Text style={styles.alertDate}>{item.date}</Text>
                    <Text style={styles.alertMessage}>{item.message}</Text>
                  </View>
                  <Badge
                    label={item.severity.toUpperCase()}
                    variant={item.severity === 'error' ? 'danger' : item.severity === 'warning' ? 'warning' : 'info'}
                  />
                </View>
              </CardBody>
            </Card>
          )}
        />

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
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    gap: 8,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2196F3',
  },
  radarContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  alertCard: {
    marginHorizontal: 12,
    marginVertical: 4,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertDate: {
    fontSize: 10,
    color: '#999',
    marginBottom: 2,
  },
  alertMessage: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
});
