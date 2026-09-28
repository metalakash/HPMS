/**
 * Compliance Monitoring - Monitor multiple covenants in real-time
 */

import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, FlatList, Text } from 'react-native';
import { ScreenContainer, Header, Card, CardBody, Badge, Spacer, Select } from '@/components';
import { RadarChart, DualAxisChart } from '@/components/charts';

interface CovenantMonitor {
  id: string;
  name: string;
  value: number;
  status: 'compliant' | 'warning' | 'breached';
  confidence: number;
}

interface AlertConfig {
  id: string;
  covenantName: string;
  warningThreshold: number;
  criticalThreshold: number;
  enabled: boolean;
}

export const ComplianceMonitoringScreen = ({ navigation }: any) => {
  const [timeframe, setTimeframe] = useState('30d');
  const [alertsEnabled, setAlertsEnabled] = useState(true);

  const [monitoringData] = useState<CovenantMonitor[]>([
    { id: '1', name: 'Debt-to-Equity', value: 82, status: 'compliant', confidence: 95 },
    { id: '2', name: 'Efficiency', value: 89, status: 'compliant', confidence: 92 },
    { id: '3', name: 'Current Ratio', value: 78, status: 'warning', confidence: 88 },
    { id: '4', name: 'Water Flow', value: 65, status: 'breached', confidence: 91 },
    { id: '5', name: 'Maintenance %', value: 95, status: 'compliant', confidence: 87 },
  ]);

  const [alertConfigs] = useState<AlertConfig[]>([
    {
      id: '1',
      covenantName: 'Debt-to-Equity Ratio',
      warningThreshold: 2.0,
      criticalThreshold: 2.5,
      enabled: true,
    },
    {
      id: '2',
      covenantName: 'Efficiency Rate',
      warningThreshold: 80,
      criticalThreshold: 75,
      enabled: true,
    },
    {
      id: '3',
      covenantName: 'Current Ratio',
      warningThreshold: 1.2,
      criticalThreshold: 1.0,
      enabled: true,
    },
  ]);

  const [comparisonData] = useState([
    { label: 'Debt', value1: 82, value2: 90 },
    { label: 'Efficiency', value1: 89, value2: 85 },
    { label: 'Current', value1: 78, value2: 80 },
    { label: 'Flow', value1: 65, value2: 75 },
    { label: 'Maintenance', value1: 95, value2: 92 },
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

  return (
    <ScreenContainer>
      <Header title="Compliance Monitoring" onBack={() => navigation.goBack()} />
      <Spacer size="small" />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Time Period Selector */}
        <Text style={styles.sectionTitle}>Time Period</Text>
        <View style={styles.periodSelector}>
          <Select
            options={[
              { label: '7 Days', value: '7d' },
              { label: '30 Days', value: '30d' },
              { label: '90 Days', value: '90d' },
              { label: 'Year', value: 'year' },
            ]}
            value={timeframe}
            onValueChange={setTimeframe}
            containerStyle={styles.selectContainer}
          />
        </View>

        <Spacer size="large" />

        {/* Multi-Covenant Radar Chart */}
        <Text style={styles.sectionTitle}>Compliance Profile</Text>
        <Card>
          <CardBody style={styles.chartContainer}>
            <RadarChart
              data={monitoringData.map(m => ({
                label: m.name,
                value: m.value,
              }))}
              width={260}
              height={260}
              color="#2196F3"
              maxValue={100}
            />
          </CardBody>
        </Card>

        <Spacer size="large" />

        {/* Comparison Chart */}
        <Text style={styles.sectionTitle}>Current vs Previous Period</Text>
        <Card>
          <CardBody>
            <DualAxisChart
              data={comparisonData}
              width={280}
              height={200}
              color1="#2196F3"
              color2="#4CAF50"
              label1="Current"
              label2="Previous"
            />
          </CardBody>
        </Card>

        <Spacer size="large" />

        {/* Real-time Monitoring */}
        <Text style={styles.sectionTitle}>Live Status</Text>
        <FlatList
          data={monitoringData}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <Card style={styles.monitorCard}>
              <CardBody>
                <View style={styles.monitorRow}>
                  <View style={styles.monitorInfo}>
                    <Text style={styles.monitorName}>{item.name}</Text>
                    <View style={styles.confidenceBar}>
                      <View
                        style={[
                          styles.confidenceProgress,
                          {
                            width: `${item.confidence}%`,
                            backgroundColor: getStatusColor(item.status),
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.confidenceText}>
                      {item.confidence}% confidence
                    </Text>
                  </View>
                  <View style={styles.monitorValue}>
                    <Text style={[styles.value, { color: getStatusColor(item.status) }]}>
                      {item.value}%
                    </Text>
                  </View>
                  <Badge label={item.status} variant={getStatusVariant(item.status)} />
                </View>
              </CardBody>
            </Card>
          )}
        />

        <Spacer size="large" />

        {/* Alert Configuration */}
        <Text style={styles.sectionTitle}>Alert Configuration</Text>
        <Card>
          <CardBody>
            <View style={styles.alertToggle}>
              <Text style={styles.alertLabel}>Notifications Enabled</Text>
              <Badge
                label={alertsEnabled ? 'ON' : 'OFF'}
                variant={alertsEnabled ? 'success' : 'secondary'}
              />
            </View>
          </CardBody>
        </Card>

        <Spacer size="medium" />

        {/* Alert Thresholds */}
        <Text style={styles.sectionTitle}>Threshold Configuration</Text>
        <FlatList
          data={alertConfigs}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <Card style={styles.alertCard}>
              <CardBody>
                <Text style={styles.alertConfigName}>{item.covenantName}</Text>
                <View style={styles.thresholdRow}>
                  <View style={styles.thresholdItem}>
                    <Text style={styles.thresholdLabel}>⚠️ Warning</Text>
                    <Text style={styles.thresholdValue}>{item.warningThreshold}</Text>
                  </View>
                  <View style={styles.thresholdItem}>
                    <Text style={styles.thresholdLabel}>🔴 Critical</Text>
                    <Text style={styles.thresholdValue}>{item.criticalThreshold}</Text>
                  </View>
                  <Badge
                    label={item.enabled ? 'Active' : 'Disabled'}
                    variant={item.enabled ? 'success' : 'secondary'}
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
  periodSelector: {
    paddingHorizontal: 16,
  },
  selectContainer: {
    marginBottom: 0,
  },
  chartContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  monitorCard: {
    marginHorizontal: 12,
    marginVertical: 4,
  },
  monitorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  monitorInfo: {
    flex: 1,
  },
  monitorName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  confidenceBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginBottom: 4,
    overflow: 'hidden',
  },
  confidenceProgress: {
    height: 4,
    borderRadius: 2,
  },
  confidenceText: {
    fontSize: 10,
    color: '#999',
  },
  monitorValue: {
    alignItems: 'flex-end',
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
  },
  alertToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  alertCard: {
    marginHorizontal: 12,
    marginVertical: 4,
  },
  alertConfigName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  thresholdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thresholdItem: {
    flex: 1,
  },
  thresholdLabel: {
    fontSize: 10,
    color: '#999',
    marginBottom: 2,
  },
  thresholdValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
});
