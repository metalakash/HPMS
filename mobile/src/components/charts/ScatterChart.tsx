/**
 * ScatterChart - X-Y coordinate scatter plot component
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, Text } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

interface DataPoint {
  x: number;
  y: number;
  label?: string;
  color?: string;
}

interface ScatterChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  containerStyle?: ViewStyle;
  title?: string;
  xLabel?: string;
  yLabel?: string;
}

export const ScatterChart: React.FC<ScatterChartProps> = ({
  data,
  width = 300,
  height = 250,
  containerStyle,
  title,
  xLabel = 'X Axis',
  yLabel = 'Y Axis',
}) => {
  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, containerStyle]}>
        <Text style={styles.emptyText}>No data</Text>
      </View>
    );
  }

  const maxX = Math.max(...data.map(d => d.x));
  const minX = Math.min(...data.map(d => d.x));
  const maxY = Math.max(...data.map(d => d.y));
  const minY = Math.min(...data.map(d => d.y));

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const points = data.map((point, index) => {
    const normalizedX = (point.x - minX) / rangeX;
    const normalizedY = (point.y - minY) / rangeY;
    const x = padding + normalizedX * chartWidth;
    const y = padding + chartHeight - normalizedY * chartHeight;
    return { x, y, ...point };
  });

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
          strokeWidth="2"
        />
        <Line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#e0e0e0"
          strokeWidth="2"
        />

        {/* Grid lines */}
        {Array.from({ length: 5 }).map((_, i) => {
          const x = padding + (i / 4) * chartWidth;
          return (
            <Line
              key={`v-grid-${i}`}
              x1={x}
              y1={padding}
              x2={x}
              y2={height - padding}
              stroke="#f0f0f0"
              strokeWidth="1"
            />
          );
        })}
        {Array.from({ length: 5 }).map((_, i) => {
          const y = padding + (i / 4) * chartHeight;
          return (
            <Line
              key={`h-grid-${i}`}
              x1={padding}
              y1={height - padding - y}
              x2={width - padding}
              y2={height - padding - y}
              stroke="#f0f0f0"
              strokeWidth="1"
            />
          );
        })}

        {/* Data points */}
        {points.map((point, index) => (
          <Circle
            key={`point-${index}`}
            cx={point.x}
            cy={point.y}
            r="5"
            fill={point.color || '#1976d2'}
            opacity="0.7"
          />
        ))}
      </Svg>
      <View style={styles.labelsContainer}>
        <Text style={styles.axisLabel}>{xLabel}</Text>
      </View>
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
  labelsContainer: {
    alignItems: 'center',
    marginTop: 12,
  },
  axisLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
});
