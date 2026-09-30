import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Card, CardBody } from '@/components';

interface CostTrackerProps {
  estimatedCost: number;
  actualCost?: number;
  variance?: number;
}

export const CostTracker = ({
  estimatedCost,
  actualCost,
  variance,
}: CostTrackerProps) => {
  const getVarianceColor = (v?: number) => {
    if (!v) return '#999';
    if (v > 0) return '#D32F2F'; // Over budget
    return '#388E3C'; // Under budget
  };

  const percentageUsed = actualCost ? (actualCost / estimatedCost) * 100 : 0;

  return (
    <Card>
      <CardBody>
        <View style={styles.header}>
          <Text style={styles.title}>Cost Tracking</Text>
          {variance !== undefined && (
            <Text style={[styles.variance, { color: getVarianceColor(variance) }]}>
              {variance > 0 ? '+' : ''} ${Math.abs(variance).toLocaleString()}
            </Text>
          )}
        </View>

        <View style={styles.costs}>
          <View style={styles.cost}>
            <Text style={styles.label}>Estimated:</Text>
            <Text style={styles.value}>${estimatedCost.toLocaleString()}</Text>
          </View>
          {actualCost !== undefined && (
            <View style={styles.cost}>
              <Text style={styles.label}>Actual:</Text>
              <Text style={styles.value}>${actualCost.toLocaleString()}</Text>
            </View>
          )}
        </View>

        {actualCost !== undefined && (
          <>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progress,
                  {
                    width: `${Math.min(percentageUsed, 100)}%`,
                    backgroundColor:
                      percentageUsed > 100 ? '#D32F2F' : '#1976D2',
                  },
                ]}
              />
            </View>
            <Text style={styles.percentage}>
              {percentageUsed.toFixed(0)}% of budget used
            </Text>
          </>
        )}
      </CardBody>
    </Card>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  variance: {
    fontSize: 14,
    fontWeight: '600',
  },
  costs: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  cost: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  value: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#EEE',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progress: {
    height: '100%',
    borderRadius: 4,
  },
  percentage: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});
