/**
 * DualAxisChart - Chart with two Y-axes for comparing different scales
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, Text } from 'react-native';
import Svg, { Polyline, Line, Circle, Text as SvgText } from 'react-native-svg';

interface DataPoint {
  label?: string;
  value1: number;
  value2: number;
}

interface DualAxisChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  color1?: string;
  color2?: string;
  containerStyle?: ViewStyle;
  title?: string;
  label1?: string;
  label2?: string;
}

export const DualAxisChart: React.FC<DualAxisChartProps> = ({
  data,
  width = 300,
  height = 250,
  color1 = '#1976d2',
  color2 = '#388e3c',
  containerStyle,
  title,
  label1 = 'Series 1',
  label2 = 'Series 2',
}) => {
  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, containerStyle]}>
        <Text style={styles.emptyText}>No data</Text>
      </View>
    );
  }

  const max1 = Math.max(...data.map(d => d.value1));
  const min1 = Math.min(...data.map(d => d.value1));
  const max2 = Math.max(...data.map(d => d.value2));
  const min2 = Math.min(...data.map(d => d.value2));

  const range1 = max1 - min1 || 1;
  const range2 = max2 - min2 || 1;

  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const points1 = data.map((point, index) => {
    const x = padding + (index / (data.length - 1 || 1)) * chartWidth;
    const normalizedValue = (point.value1 - min1) / range1;
    const y = padding + chartHeight - normalizedValue * chartHeight;
    return `${x},${y}`;
  });

  const points2 = data.map((point, index) => {
    const x = padding + (index / (data.length - 1 || 1)) * chartWidth;
    const normalizedValue = (point.value2 - min2) / range2;
    const y = padding + chartHeight - normalizedValue * chartHeight;
    return `${x},${y}`;
  });

  const linePoints1 = points1.join(' ');
  const linePoints2 = points2.join(' ');

  return (
    <View style={[styles.container, containerStyle]}>
      {title && <Text style={styles.title}>{title}</Text>}
      <Svg width={width} height={height}>
        {/* Left axis */}
        <Line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          stroke={color1}
          strokeWidth="2"
        />
        {/* Right axis */}
        <Line
          x1={width - padding}
          y1={padding}
          x2={width - padding}
          y2={height - padding}
          stroke={color2}
          strokeWidth="2"
        />
        {/* Bottom axis */}
        <Line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#e0e0e0"
          strokeWidth="1"
        />

        {/* Grid lines */}
        <Line
          x1={padding}
          y1={padding}
          x2={width - padding}
          y2={padding}
          stroke="#f0f0f0"
          strokeWidth="1"
        />

        {/* First line */}
        <Polyline
          points={linePoints1}
          fill="none"
          stroke={color1}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.8"
        />

        {/* Second line */}
        <Polyline
          points={linePoints2}
          fill="none"
          stroke={color2}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.8"
        />

        {/* Data points for series 1 */}
        {data.map((_, index) => {
          const x = padding + (index / (data.length - 1 || 1)) * chartWidth;
          const point = points1[index].split(',');
          return (
            <Circle
              key={`point1-${index}`}
              cx={Number(point[0])}
              cy={Number(point[1])}
              r="3"
              fill={color1}
            />
          );
        })}

        {/* Data points for series 2 */}
        {data.map((_, index) => {
          const point = points2[index].split(',');
          return (
            <Circle
              key={`point2-${index}`}
              cx={Number(point[0])}
              cy={Number(point[1])}
              r="3"
              fill={color2}
            />
          );
        })}

        {/* Axis labels */}
        <SvgText
          x={padding - 20}
          y={20}
          fontSize="10"
          fill={color1}
          fontWeight="bold"
        >
          {label1}
        </SvgText>
        <SvgText
          x={width - padding - 20}
          y={20}
          fontSize="10"
          fill={color2}
          fontWeight="bold"
        >
          {label2}
        </SvgText>
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
