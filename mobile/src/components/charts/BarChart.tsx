/**
 * BarChart - SVG-based bar chart component
 */

import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  Text,
} from 'react-native';
import Svg, { Rect, Line } from 'react-native-svg';

interface BarData {
  value: number;
  label?: string;
}

interface BarChartProps {
  data: BarData[];
  width?: number;
  height?: number;
  barColor?: string;
  containerStyle?: ViewStyle;
  title?: string;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  width = 300,
  height = 200,
  barColor = '#1976d2',
  containerStyle,
  title,
}) => {
  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, containerStyle]}>
        <Text style={styles.emptyText}>No data</Text>
      </View>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value));
  const padding = 20;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const barWidth = chartWidth / (data.length * 1.2);

  return (
    <View style={[styles.container, containerStyle]}>
      {title && <Text style={styles.title}>{title}</Text>}
      <Svg width={width} height={height}>
        {/* Axes */}
        <Line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          stroke="#e0e0e0"
          strokeWidth="1"
        />
        <Line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#e0e0e0"
          strokeWidth="1"
        />
        {/* Bars */}
        {data.map((bar, index) => {
          const barHeight = (bar.value / maxValue) * chartHeight;
          const x =
            padding +
            (index / data.length) * chartWidth +
            barWidth * 0.1;
          const y = height - padding - barHeight;

          return (
            <Rect
              key={index}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              fill={barColor}
            />
          );
        })}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
