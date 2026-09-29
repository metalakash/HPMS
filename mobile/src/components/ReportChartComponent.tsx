/**
 * Report Chart Component
 * Reusable chart visualization component
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from 'react-native';

type ChartType = 'bar' | 'line' | 'pie' | 'area';

interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

interface ReportChartComponentProps {
  type: ChartType;
  data: ChartDataPoint[];
  title?: string;
  theme?: 'light' | 'dark';
  onDataPointTap?: (point: ChartDataPoint, index: number) => void;
}

export const ReportChartComponent: React.FC<ReportChartComponentProps> = ({
  type,
  data,
  title,
  theme = 'light',
  onDataPointTap,
}) => {
  const width = Dimensions.get('window').width - 32;
  const maxValue = useMemo(() => Math.max(...data.map(d => d.value)), [data]);

  const defaultColors = [
    '#1976d2',
    '#388e3c',
    '#d32f2f',
    '#f57c00',
    '#7b1fa2',
    '#0097a7',
  ];

  const chartData = data.map((point, index) => ({
    ...point,
    color: point.color || defaultColors[index % defaultColors.length],
    percentage: maxValue > 0 ? (point.value / maxValue) * 100 : 0,
  }));

  const renderBarChart = () => (
    <View style={styles.barChart}>
      {chartData.map((point, index) => (
        <TouchableOpacity
          key={index}
          style={styles.barItem}
          onPress={() => onDataPointTap?.(data[index], index)}
        >
          <View style={styles.barLabel}>
            <Text style={[
              styles.barLabelText,
              theme === 'dark' && styles.darkText,
            ]}>
              {point.label}
            </Text>
          </View>
          <View style={styles.barContainer}>
            <View
              style={[
                styles.bar,
                {
                  width: `${point.percentage}%`,
                  backgroundColor: point.color,
                },
              ]}
            />
          </View>
          <Text style={[
            styles.barValue,
            theme === 'dark' && styles.darkText,
          ]}>
            {point.value}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderLineChart = () => (
    <View style={styles.lineChart}>
      <View style={styles.yAxis}>
        {[0, 25, 50, 75, 100].map((val, i) => (
          <Text key={i} style={[
            styles.yAxisLabel,
            theme === 'dark' && styles.darkText,
          ]}>
            {Math.round((val / 100) * maxValue)}
          </Text>
        ))}
      </View>
      <View style={styles.chartArea}>
        {chartData.map((point, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.dataPoint,
              {
                left: (width * index) / chartData.length,
                bottom: `${point.percentage}%`,
                backgroundColor: point.color,
              },
            ]}
            onPress={() => onDataPointTap?.(data[index], index)}
          />
        ))}
      </View>
    </View>
  );

  const renderPieChart = () => (
    <View style={styles.pieChart}>
      <View style={styles.pieContainer}>
        {chartData.map((point, index) => (
          <View
            key={index}
            style={[
              styles.pieSlice,
              {
                backgroundColor: point.color,
                flex: point.value,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.pieSliceTouchable}
              onPress={() => onDataPointTap?.(data[index], index)}
            />
          </View>
        ))}
      </View>
      <View style={styles.pieLegend}>
        {chartData.map((point, index) => (
          <View key={index} style={styles.legendItem}>
            <View
              style={[
                styles.legendColor,
                { backgroundColor: point.color },
              ]}
            />
            <Text style={[
              styles.legendText,
              theme === 'dark' && styles.darkText,
            ]}>
              {point.label}: {point.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderChart = () => {
    switch (type) {
      case 'bar':
        return renderBarChart();
      case 'line':
        return renderLineChart();
      case 'pie':
        return renderPieChart();
      case 'area':
        return renderBarChart(); // Simplified area as stacked bar
      default:
        return null;
    }
  };

  return (
    <View style={[
      styles.container,
      theme === 'dark' && styles.darkContainer,
    ]}>
      {title && (
        <Text style={[
          styles.title,
          theme === 'dark' && styles.darkText,
        ]}>
          {title}
        </Text>
      )}
      {renderChart()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginVertical: 8,
  },
  darkContainer: {
    backgroundColor: '#1e1e1e',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 16,
  },
  darkText: {
    color: '#fff',
  },
  barChart: {
    height: 200,
    justifyContent: 'space-around',
  },
  barItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barLabel: {
    width: 60,
  },
  barLabelText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  barContainer: {
    flex: 1,
    height: 20,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 2,
  },
  barValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#212121',
    minWidth: 40,
    textAlign: 'right',
  },
  lineChart: {
    height: 200,
    flexDirection: 'row',
  },
  yAxis: {
    width: 40,
    justifyContent: 'space-between',
    marginRight: 8,
  },
  yAxisLabel: {
    fontSize: 10,
    color: '#999',
  },
  chartArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    position: 'relative',
  },
  dataPoint: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  pieChart: {
    alignItems: 'center',
    height: 250,
  },
  pieContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  pieSlice: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pieSliceTouchable: {
    flex: 1,
    width: '100%',
  },
  pieLegend: {
    marginTop: 16,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
});
