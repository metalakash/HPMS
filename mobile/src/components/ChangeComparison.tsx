/**
 * Change Comparison Component
 * Before/after value comparison for update operations
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';

interface ChangeComparisonProps {
  before: any;
  after: any;
  fieldName: string;
}

export const ChangeComparison: React.FC<ChangeComparisonProps> = ({
  before,
  after,
  fieldName,
}) => {
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) {
      return '(empty)';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }

    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }

    return String(value);
  };

  const beforeString = formatValue(before);
  const afterString = formatValue(after);

  const hasChanged = beforeString !== afterString;

  return (
    <View style={styles.container} testID={`change-comparison-${fieldName}`}>
      <Text style={styles.fieldName}>{fieldName}</Text>

      <View style={styles.comparisonContainer}>
        {/* Before Column */}
        <View style={styles.column}>
          <View style={styles.columnHeader}>
            <Text style={styles.columnTitle}>Before</Text>
          </View>
          <View style={[styles.columnContent, !hasChanged && styles.columnContentUnchanged]}>
            <Text
              style={[
                styles.valueText,
                beforeString === '(empty)' && styles.emptyText,
              ]}
            >
              {beforeString}
            </Text>
          </View>
        </View>

        {/* Arrow */}
        <View style={styles.arrowContainer}>
          <Text style={styles.arrow}>→</Text>
        </View>

        {/* After Column */}
        <View style={styles.column}>
          <View style={styles.columnHeader}>
            <Text style={styles.columnTitle}>After</Text>
          </View>
          <View style={[styles.columnContent, !hasChanged && styles.columnContentUnchanged]}>
            <Text
              style={[
                styles.valueText,
                afterString === '(empty)' && styles.emptyText,
              ]}
            >
              {afterString}
            </Text>
          </View>
        </View>
      </View>

      {/* Changelog Summary */}
      {hasChanged && (
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryText}>
            ✓ Field updated
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  fieldName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  comparisonContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  column: {
    flex: 1,
  },
  columnHeader: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#f5f5f5',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    marginBottom: 1,
  },
  columnTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  columnContent: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 0,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    minHeight: 60,
    justifyContent: 'center',
  },
  columnContentUnchanged: {
    backgroundColor: '#f9f9f9',
  },
  valueText: {
    fontSize: 12,
    color: '#333',
    fontFamily: 'Courier New',
    lineHeight: 18,
  },
  emptyText: {
    color: '#999',
    fontStyle: 'italic',
  },
  arrowContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  arrow: {
    fontSize: 18,
    color: '#999',
    fontWeight: 'bold',
  },
  summaryContainer: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#e8f5e9',
    borderRadius: 4,
  },
  summaryText: {
    fontSize: 11,
    color: '#2e7d32',
    fontWeight: '500',
  },
});
