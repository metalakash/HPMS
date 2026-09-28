/**
 * Production Analytics - Production output tracking and analysis
 */

import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, FlatList, Text } from 'react-native';
import { ScreenContainer, Header, Card, CardBody, Badge, Spacer, Button } from '@/components';
import { LineChart, BarChart } from '@/components/charts';

interface ProductionMetric {
  id: string;
  month: string;
  mw: number;
  efficiency: number;
  target: number;
}

export const ProductionAnalyticsScreen = ({ navigation }: any) => {
  const [metrics] = useState<ProductionMetric[]>([
    { id: '1', month: 'Jan', mw: 1100, efficiency: 85, target: 1200 },
    { id: '2', month: 'Feb', mw: 1200, efficiency: 87, target: 1200 },
    { id: '3', month: 'Mar', mw: 1150, efficiency: 86, target: 1200 },
    { id: '4', month: 'Apr', mw: 1300, efficiency: 88, target: 1200 },
    { id: '5', month: 'May', mw: 1250, efficiency: 89, target: 1200 },
    { id: '6', month: 'Jun', mw: 1400, efficiency: 90, target: 1200 },
  ]);

  const avgMW = Math.round(metrics.reduce((sum, m) => sum + m.mw, 0) / metrics.length);
  const totalMW = metrics.reduce((sum, m) => sum + m.mw, 0);
  const maxMW = Math.max(...metrics.map(m => m.mw));

  return (
    <ScreenContainer>
      <Header title="Production Analytics" onBack={() => navigation.goBack()} />
      <Spacer size="small" />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Summary Stats */}
        <Text style={styles.sectionTitle}>Summary</Text>
        <View style={styles.statsContainer}>
          <Card style={styles.statCard}>
            <CardBody>
              <Text style={styles.statLabel}>Total Production</Text>
              <Text style={styles.statValue}>{totalMW.toLocaleString()}</Text>
              <Text style={styles.statUnit}>MW</Text>
            </CardBody>
          </Card>
          <Card style={styles.statCard}>
            <CardBody>
              <Text style={styles.statLabel}>Average</Text>
              <Text style={styles.statValue}>{avgMW.toLocaleString()}</Text>
              <Text style={styles.statUnit}>MW</Text>
            </CardBody>
          </Card>
          <Card style={styles.statCard}>
            <CardBody>
              <Text style={styles.statLabel}>Peak</Text>
              <Text style={styles.statValue}>{maxMW.toLocaleString()}</Text>
              <Text style={styles.statUnit}>MW</Text>
            </CardBody>
          </Card>
        </View>

        <Spacer size="large" />

        {/* Production Trend */}
        <Text style={styles.sectionTitle}>Production Trend (MW)</Text>
        <Card>
          <CardBody>
            <LineChart
              data={metrics.map(m => ({ value: m.mw, label: m.month }))}
              width={280}
              height={200}
              color="#4CAF50"
            />
          </CardBody>
        </Card>

        <Spacer size="large" />

        {/* Production vs Target */}
        <Text style={styles.sectionTitle}>Production vs Target</Text>
        <Card>
          <CardBody>
            <BarChart
              data={metrics.map(m => ({
                label: m.month,
                value: m.mw,
                target: m.target,
              }))}
              width={280}
              height={180}
              color="#2196F3"
            />
          </CardBody>
        </Card>

        <Spacer size="large" />

        {/* Monthly Breakdown */}
        <Text style={styles.sectionTitle}>Monthly Breakdown</Text>
        <FlatList
          data={metrics}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <Card style={styles.monthCard}>
              <CardBody>
                <View style={styles.monthRow}>
                  <View style={styles.monthInfo}>
                    <Text style={styles.monthName}>{item.month}</Text>
                    <Text style={styles.monthMW}>{item.mw} MW</Text>
                  </View>
                  <View style={styles.monthStats}>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progress,
                          {
                            width: `${(item.mw / item.target) * 100}%`,
                            backgroundColor:
                              item.mw >= item.target ? '#4CAF50' : '#FF9800',
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {((item.mw / item.target) * 100).toFixed(0)}%
                    </Text>
                  </View>
                  <Badge
                    label={`${item.efficiency}%`}
                    variant={item.efficiency >= 85 ? 'success' : 'warning'}
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
    fontSize: 16,
    fontWeight: '700',
    color: '#4CAF50',
  },
  statUnit: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  monthCard: {
    marginHorizontal: 12,
    marginVertical: 4,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  monthInfo: {
    width: 50,
  },
  monthName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  monthMW: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4CAF50',
    marginTop: 2,
  },
  monthStats: {
    flex: 1,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    marginBottom: 4,
    overflow: 'hidden',
  },
  progress: {
    height: 6,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 10,
    color: '#999',
  },
});
