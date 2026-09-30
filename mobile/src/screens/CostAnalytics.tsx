/**
 * Cost Analytics - Cost tracking, budget vs actual, and forecasts
 */

import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, FlatList, Text } from 'react-native';
import { ScreenContainer, Header, Card, CardBody, Badge, Spacer } from '@/components';
import { BarChart, PieChart, LineChart } from '@/components/charts';

interface CostItem {
  id: string;
  category: string;
  budget: number;
  actual: number;
  color: string;
}

interface MonthlyCost {
  label: string;
  budget: number;
  actual: number;
}

export const CostAnalyticsScreen = ({ navigation }: any) => {
  const [costItems] = useState<CostItem[]>([
    { id: '1', category: 'Operations', budget: 50000, actual: 48500, color: '#1976d2' },
    { id: '2', category: 'Maintenance', budget: 35000, actual: 36200, color: '#388e3c' },
    { id: '3', category: 'Personnel', budget: 60000, actual: 62000, color: '#f57c00' },
    { id: '4', category: 'Equipment', budget: 40000, actual: 38900, color: '#c62828' },
  ]);

  const [monthlyCosts] = useState<MonthlyCost[]>([
    { label: 'Jan', budget: 100000, actual: 98500 },
    { label: 'Feb', budget: 100000, actual: 102000 },
    { label: 'Mar', budget: 100000, actual: 99200 },
    { label: 'Apr', budget: 100000, actual: 105000 },
    { label: 'May', budget: 100000, actual: 103500 },
    { label: 'Jun', budget: 100000, actual: 101800 },
  ]);

  const totalBudget = costItems.reduce((sum, item) => sum + item.budget, 0);
  const totalActual = costItems.reduce((sum, item) => sum + item.actual, 0);
  const variance = totalBudget - totalActual;
  const variancePercent = (variance / totalBudget) * 100;

  return (
    <ScreenContainer>
      <Header title="Cost Analytics" onBack={() => navigation.goBack()} />
      <Spacer size="small" />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Budget Summary */}
        <Text style={styles.sectionTitle}>Budget Summary</Text>
        <Card>
          <CardBody>
            <View style={styles.summaryContainer}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Budget Allocated</Text>
                <Text style={styles.summaryValue}>${totalBudget.toLocaleString()}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Spent</Text>
                <Text style={styles.summaryValue}>${totalActual.toLocaleString()}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Variance</Text>
                <Text style={[styles.summaryValue, { color: variance > 0 ? '#4CAF50' : '#F44336' }]}>
                  {variance > 0 ? '+' : ''}{variance.toLocaleString()}
                </Text>
                <Text style={styles.percentageText}>
                  ({variancePercent > 0 ? '+' : ''}{variancePercent.toFixed(1)}%)
                </Text>
              </View>
            </View>
          </CardBody>
        </Card>

        <Spacer size="large" />

        {/* Cost by Category Pie Chart */}
        <Text style={styles.sectionTitle}>Spending by Category</Text>
        <Card>
          <CardBody>
            <PieChart
              data={costItems.map(item => ({
                label: item.category,
                value: item.actual,
                color: item.color,
              }))}
              width={280}
              height={220}
              showLegend={true}
            />
          </CardBody>
        </Card>

        <Spacer size="large" />

        {/* Monthly Comparison */}
        <Text style={styles.sectionTitle}>Monthly Budget vs Actual</Text>
        <Card>
          <CardBody>
            <BarChart
              data={monthlyCosts.map(m => ({
                label: m.label,
                value: m.actual,
                target: m.budget,
              }))}
              width={280}
              height={180}
              color="#f57c00"
            />
          </CardBody>
        </Card>

        <Spacer size="large" />

        {/* Category Breakdown */}
        <Text style={styles.sectionTitle}>Budget by Category</Text>
        <FlatList
          data={costItems}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => {
            const variance = item.budget - item.actual;
            const variancePercent = (variance / item.budget) * 100;
            const isOver = variance < 0;

            return (
              <Card style={styles.categoryCard}>
                <CardBody>
                  <View style={styles.categoryHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.categoryName}>{item.category}</Text>
                      <View style={styles.costRow}>
                        <Text style={styles.costLabel}>Budget:</Text>
                        <Text style={styles.costValue}>${item.budget.toLocaleString()}</Text>
                      </View>
                      <View style={styles.costRow}>
                        <Text style={styles.costLabel}>Spent:</Text>
                        <Text style={styles.costValue}>${item.actual.toLocaleString()}</Text>
                      </View>
                    </View>
                    <Badge
                      label={isOver ? '⚠ Over' : '✓ Under'}
                      variant={isOver ? 'warning' : 'success'}
                    />
                  </View>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progress,
                        {
                          width: `${Math.min((item.actual / item.budget) * 100, 100)}%`,
                          backgroundColor: isOver ? '#F44336' : '#4CAF50',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.varianceText}>
                    {isOver ? 'Over: ' : 'Under: '}${Math.abs(variance).toLocaleString()} ({variancePercent.toFixed(1)}%)
                  </Text>
                </CardBody>
              </Card>
            );
          }}
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
  summaryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  percentageText: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e0e0e0',
  },
  categoryCard: {
    marginHorizontal: 12,
    marginVertical: 4,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  costLabel: {
    fontSize: 11,
    color: '#999',
  },
  costValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    marginVertical: 8,
    overflow: 'hidden',
  },
  progress: {
    height: 6,
    borderRadius: 3,
  },
  varianceText: {
    fontSize: 10,
    color: '#999',
  },
});
