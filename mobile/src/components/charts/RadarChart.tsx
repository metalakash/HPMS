/**
 * RadarChart - Multi-axis radar/spider chart component
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, Text, FlatList } from 'react-native';
import Svg, { Polyline, Line, Circle, Text as SvgText } from 'react-native-svg';

interface DataPoint {
  label: string;
  value: number;
}

interface RadarChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  color?: string;
  containerStyle?: ViewStyle;
  title?: string;
  maxValue?: number;
}

export const RadarChart: React.FC<RadarChartProps> = ({
  data,
  width = 300,
  height = 300,
  color = '#1976d2',
  containerStyle,
  title,
  maxValue = 100,
}) => {
  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, containerStyle]}>
        <Text style={styles.emptyText}>No data</Text>
      </View>
    );
  }

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(cx, cy) - 40;
  const levels = 5;

  const angleSlice = (Math.PI * 2) / data.length;

  const points = data.map((point, index) => {
    const angle = angleSlice * index - Math.PI / 2;
    const normalizedValue = Math.min(point.value / maxValue, 1);
    const r = radius * normalizedValue;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    return { x, y, ...point };
  });

  const polygonPoints = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <View style={[styles.container, containerStyle]}>
      {title && <Text style={styles.title}>{title}</Text>}
      <Svg width={width} height={height}>
        {/* Background circles */}
        {Array.from({ length: levels }).map((_, level) => {
          const r = radius * ((level + 1) / levels);
          return (
            <Circle
              key={`level-${level}`}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="#e0e0e0"
              strokeWidth="1"
            />
          );
        })}

        {/* Axis lines */}
        {data.map((_, index) => {
          const angle = angleSlice * index - Math.PI / 2;
          const x = cx + radius * Math.cos(angle);
          const y = cy + radius * Math.sin(angle);
          return (
            <Line
              key={`axis-${index}`}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="#e0e0e0"
              strokeWidth="1"
            />
          );
        })}

        {/* Data polygon */}
        <Polyline
          points={polygonPoints}
          fill={color}
          fillOpacity="0.3"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Data points */}
        {points.map((point, index) => (
          <Circle
            key={`point-${index}`}
            cx={point.x}
            cy={point.y}
            r="4"
            fill={color}
          />
        ))}

        {/* Labels */}
        {points.map((point, index) => {
          const angle = angleSlice * index - Math.PI / 2;
          const labelRadius = radius + 30;
          const labelX = cx + labelRadius * Math.cos(angle);
          const labelY = cy + labelRadius * Math.sin(angle);
          return (
            <SvgText
              key={`label-${index}`}
              x={labelX}
              y={labelY}
              fontSize="10"
              fill="#666"
              textAnchor="middle"
            >
              {data[index].label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
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
