/**
 * Analytics Dashboard - Portfolio overview of all key metrics
 */

import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, FlatList, ActivityIndicator, Text } from 'react-native';
import { ScreenContainer, Header, Card, CardBody, Badge, Spacer, Button } from '@/components';
import { LineChart, GaugeChart, BarChart } from '@/components/charts';
import { useAppStore } from '@/store/app.store';

interface KPI {
  id: string;
  label: string;
  value: number;
  unit: string;
  target?: number;
  trend?: number;
  color: string;
}

export const AnalyticsScreen = ({ navigation }: any) => {
  const [loading, setLoading] = useState(false);
  const [kpis, setKpis] = useState<KPI[]>([
    { id: '1', label: 'Production', value: 1250, unit: 'MW', target: 1500, trend: 5.2, color: '#4CAF50' },
    { id: '2', label: 'Efficiency', value: 87.5, unit: '%', target: 90, trend: 2.1, color: '#2196F3' },
    { id: '3', label: 'Costs', value: 45200, unit: '$', trend: -3.5, color: '#FF9800' },
    { id: '4', label: 'Capacity', value: 92, unit: '%', target: 95, trend: 1.8, color: '#9C27B0' },
  ]);

  const [chartData] = useState([
    { value: 1100, label: 'Jan' },
    { value: 1200, label: 'Feb' },
    { value: 1150, label: 'Mar' },
    { value: 1300, label: 'Apr' },
    { value: 1250, label: 'May' },
    { value: 1400, label: 'Jun' },
  ]);

  const handlePeriodChange = (period: string) => {
    setLoading(true);
    setTimeout(() => setLoading(false), 500);
  };

  const handleViewDetails = (metricType: string) => {
    switch (metricType) {
      case 'production':
        navigation.navigate('ProductionAnalytics');
        break;
      case 'efficiency':
        navigation.navigate('EfficiencyAnalytics');
        break;
      case 'costs':
        navigation.navigate('CostAnalytics');
        break;
      case 'forecast':
        navigation.navigate('ForecastAnalytics');
        break;
    }
  };

  return (
    <ScreenContainer>
      <Header title="Analytics Dashboard" subtitle="Portfolio Overview" />
      <Spacer size="small" />

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        <Button
          title="7D"
          onPress={() => handlePeriodChange('7d')}
          variant="secondary"
          size="small"
        />
        <Button
          title="30D"
          onPress={() => handlePeriodChange('30d')}
          variant="primary"
          size="small"
        />
        <Button
          title="90D"
          onPress={() => handlePeriodChange('90d')}
          variant="secondary"
          size="small"
        />
        <Button
          title="Year"
          onPress={() => handlePeriodChange('year')}
          variant="secondary"
          size="small"
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* KPI Cards */}
        <Text style={styles.sectionTitle}>Key Performance Indicators</Text>
        <FlatList
          data={kpis}
          keyExtractor={(item) => item.id}
          numColumns={2}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <Card style={styles.kpiCard}>
              <CardBody>
                <View style={styles.kpiHeader}>
                  <Text style={styles.kpiLabel}>{item.label}</Text>
                  {item.trend !== undefined && (
                    <Badge
                      label={`${item.trend > 0 ? '+' : ''}${item.trend}%`}
                      variant={item.trend > 0 ? 'success' : 'warning'}
                    />
                  )}
                </View>
                <View style={styles.kpiValue}>
                  <Text style={[styles.value, { color: item.color }]}>
                    {item.value.toLocaleString()}
                  </Text>
                  <Text style={styles.unit}>{item.unit}</Text>
                </View>
                {item.target && (
                  <Text style={styles.targetText}>
                    Target: {item.target.toLocaleString()} {item.unit}
                  </Text>
                )}
              </CardBody>
            </Card>
          )}
          columnWrapperStyle={styles.row}
        />

        <Spacer size="large" />

        {/* Production Trend Chart */}
        <Text style={styles.sectionTitle}>Production Trend (30 days)</Text>
        <Card>
          <CardBody>
            {loading ? (
              <ActivityIndicator size="large" color="#1976d2" />
            ) : (
              <LineChart
                data={chartData}
                width={280}
                height={180}
                color="#4CAF50"
              />
            )}
          </CardBody>
        </Card>

        {/* Current Efficiency Gauge */}
        <Text style={styles.sectionTitle}>Current Efficiency</Text>
        <Card>
          <CardBody>
            <GaugeChart
              value={87.5}
              maxValue={100}
              color="#2196F3"
              width={250}
              height={200}
              unit="%"
            />
          </CardBody>
        </Card>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>View Details</Text>
        <View style={styles.actionsContainer}>
          <Button
            title="Production"
            onPress={() => handleViewDetails('production')}
            variant="secondary"
            size="small"
            style={styles.actionButton}
          />
          <Button
            title="Efficiency"
            onPress={() => handleViewDetails('efficiency')}
            variant="secondary"
            size="small"
            style={styles.actionButton}
          />
          <Button
            title="Costs"
            onPress={() => handleViewDetails('costs')}
            variant="secondary"
            size="small"
            style={styles.actionButton}
          />
          <Button
            title="Forecast"
            onPress={() => handleViewDetails('forecast')}
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
  periodSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  kpiCard: {
    flex: 1,
    margin: 8,
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  kpiLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  kpiValue: {
    marginVertical: 8,
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
  },
  unit: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  targetText: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    minWidth: '45%',
  },
});
