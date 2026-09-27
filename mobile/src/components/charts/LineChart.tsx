/**
 * LineChart - SVG-based line chart component
 */

import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  Text,
} from 'react-native';
import Svg, {
  Polyline,
  Line,
  Text as SvgText,
} from 'react-native-svg';

interface DataPoint {
  value: number;
  label?: string;
}

interface LineChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  color?: string;
  containerStyle?: ViewStyle;
  title?: string;
}

export const LineChart: React.FC<LineChartProps> = ({
  data,
  width = 300,
  height = 200,
  color = '#1976d2',
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
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;

  const padding = 20;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const points = data.map((point, index) => {
    const x = padding + (index / (data.length - 1 || 1)) * chartWidth;
    const normalizedValue = (point.value - minValue) / range;
    const y = padding + chartHeight - normalizedValue * chartHeight;
    return `${x},${y}`;
  }).join(' ');

  return (
    <View style={[styles.container, containerStyle]}>
      {title && <Text style={styles.title}>{title}</Text>}
      <Svg width={width} height={height}>
        {/* Grid lines */}
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
        {/* Line chart */}
        <Polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
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
