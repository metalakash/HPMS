/**
 * Forecast Analytics - Predictive analytics and forecasts
 */

import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, FlatList, Text } from 'react-native';
import { ScreenContainer, Header, Card, CardBody, Badge, Spacer } from '@/components';
import { LineChart, AreaChart } from '@/components/charts';

interface ForecastPoint {
  label: string;
  historical: number;
  forecast: number;
  lower: number;
  upper: number;
}

interface Trend {
  id: string;
  metric: string;
  current: number;
  forecast: number;
  confidence: number;
  direction: 'up' | 'down' | 'stable';
}

export const ForecastAnalyticsScreen = ({ navigation }: any) => {
  const [historicalData] = useState([
    { value: 1100, label: 'Jan' },
    { value: 1200, label: 'Feb' },
    { value: 1150, label: 'Mar' },
    { value: 1300, label: 'Apr' },
    { value: 1250, label: 'May' },
    { value: 1400, label: 'Jun' },
  ]);

  const [forecastData] = useState([
    { value: 1450, label: 'Jul' },
    { value: 1500, label: 'Aug' },
    { value: 1480, label: 'Sep' },
    { value: 1520, label: 'Oct' },
  ]);

  const [trends] = useState<Trend[]>([
    { id: '1', metric: 'Production', current: 1400, forecast: 1520, confidence: 92, direction: 'up' },
    { id: '2', metric: 'Efficiency', current: 90, forecast: 91.5, confidence: 85, direction: 'up' },
    { id: '3', metric: 'Costs', current: 102000, forecast: 105000, confidence: 88, direction: 'up' },
    { id: '4', metric: 'Downtime', current: 12, forecast: 8, confidence: 78, direction: 'down' },
  ]);

  const [seasonalData] = useState([
    { value: 85, label: 'Q1' },
    { value: 92, label: 'Q2' },
    { value: 88, label: 'Q3' },
    { value: 95, label: 'Q4' },
  ]);

  return (
    <ScreenContainer>
      <Header title="Forecast Analytics" onBack={() => navigation.goBack()} />
      <Spacer size="small" />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Forecast Summary */}
        <Text style={styles.sectionTitle}>6-Month Forecast</Text>
        <Card>
          <CardBody>
            <View style={styles.forecastSummary}>
              <View style={styles.forecastItem}>
                <Text style={styles.forecastLabel}>Current</Text>
                <Text style={styles.forecastValue}>1,400 MW</Text>
              </View>
              <Text style={styles.forecastArrow}>→</Text>
              <View style={styles.forecastItem}>
                <Text style={styles.forecastLabel}>Forecast (Oct)</Text>
                <Text style={[styles.forecastValue, { color: '#4CAF50' }]}>1,520 MW</Text>
              </View>
              <Text style={styles.growthText}>+8.6%</Text>
            </View>
          </CardBody>
        </Card>

        <Spacer size="large" />

        {/* Historical + Forecast Trend */}
        <Text style={styles.sectionTitle}>Production Trend & Forecast</Text>
        <Card>
          <CardBody>
            <View style={styles.trendContainer}>
              <Text style={styles.trendLabel}>Historical (dark), Forecast (light)</Text>
              <LineChart
                data={[...historicalData, ...forecastData]}
                width={280}
                height={180}
                color="#4CAF50"
              />
            </View>
          </CardBody>
        </Card>

        <Spacer size="large" />

        {/* Seasonal Pattern */}
        <Text style={styles.sectionTitle}>Seasonal Pattern (Efficiency %)</Text>
        <Card>
          <CardBody>
            <AreaChart
              data={seasonalData}
              width={280}
              height={160}
              color="#2196F3"
            />
          </CardBody>
        </Card>

        <Spacer size="large" />

        {/* Forecast Trends */}
        <Text style={styles.sectionTitle}>Forecast Trends</Text>
        <FlatList
          data={trends}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => {
            const change = ((item.forecast - item.current) / item.current) * 100;
            const isIncrease = change > 0;

            return (
              <Card style={styles.trendCard}>
                <CardBody>
                  <View style={styles.trendRow}>
                    <View style={styles.trendInfo}>
                      <Text style={styles.trendMetric}>{item.metric}</Text>
                      <View style={styles.currentForecast}>
                        <Text style={styles.currentValue}>{item.current}</Text>
                        <Text style={styles.trendIcon}>
                          {item.direction === 'up' ? '↑' : item.direction === 'down' ? '↓' : '→'}
                        </Text>
                        <Text style={[styles.forecastValue, { color: isIncrease ? '#F44336' : '#4CAF50' }]}>
                          {item.forecast}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.trendMeta}>
                      <Badge
                        label={`${change > 0 ? '+' : ''}${change.toFixed(1)}%`}
                        variant={isIncrease ? 'warning' : 'success'}
                      />
                      <Text style={styles.confidenceText}>
                        {item.confidence}% confidence
                      </Text>
                    </View>
                  </View>
                </CardBody>
              </Card>
            );
          }}
        />

        <Spacer size="large" />

        {/* Key Insights */}
        <Text style={styles.sectionTitle}>Key Insights</Text>
        <Card>
          <CardBody>
            <View style={styles.insightsList}>
              <Text style={styles.insightItem}>
                • Production expected to grow 8.6% over next 6 months
              </Text>
              <Text style={styles.insightItem}>
                • Strong Q4 seasonal performance anticipated
              </Text>
              <Text style={styles.insightItem}>
                • Operational costs trending upward (+2.9%)
              </Text>
              <Text style={styles.insightItem}>
                • System efficiency to improve gradually (+1.7%)
              </Text>
            </View>
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
  forecastSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  forecastItem: {
    alignItems: 'center',
  },
  forecastLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
  },
  forecastValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  forecastArrow: {
    fontSize: 24,
    color: '#ccc',
  },
  growthText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
  trendContainer: {
    alignItems: 'center',
  },
  trendLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 8,
  },
  trendCard: {
    marginHorizontal: 12,
    marginVertical: 4,
  },
  trendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  trendInfo: {
    flex: 1,
  },
  trendMetric: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  currentForecast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currentValue: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  trendIcon: {
    fontSize: 14,
    marginHorizontal: 4,
  },
  trendMeta: {
    alignItems: 'flex-end',
    gap: 6,
  },
  confidenceText: {
    fontSize: 10,
    color: '#999',
  },
  insightsList: {
    gap: 8,
  },
  insightItem: {
    fontSize: 12,
    color: '#333',
    lineHeight: 18,
  },
});
