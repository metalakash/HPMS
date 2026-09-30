/**
 * PieChart - Proportional distribution pie chart component
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, Text, FlatList } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

interface PieSlice {
  label: string;
  value: number;
  color?: string;
}

interface PieChartProps {
  data: PieSlice[];
  width?: number;
  height?: number;
  containerStyle?: ViewStyle;
  title?: string;
  showLegend?: boolean;
}

const DEFAULT_COLORS = [
  '#1976d2',
  '#388e3c',
  '#f57c00',
  '#c62828',
  '#7b1fa2',
  '#0097a7',
];

export const PieChart: React.FC<PieChartProps> = ({
  data,
  width = 300,
  height = 250,
  containerStyle,
  title,
  showLegend = true,
}) => {
  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, containerStyle]}>
        <Text style={styles.emptyText}>No data</Text>
      </View>
    );
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(cx, cy) - 20;

  let currentAngle = -90;
  const slices = data.map((d, index) => {
    const sliceAngle = (d.value / total) * 360;
    const color = d.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
    const path = createPiePath(cx, cy, radius, currentAngle, currentAngle + sliceAngle);

    const labelAngle = currentAngle + sliceAngle / 2;
    const labelRadius = radius * 0.7;
    const labelX = cx + labelRadius * Math.cos((labelAngle * Math.PI) / 180);
    const labelY = cy + labelRadius * Math.sin((labelAngle * Math.PI) / 180);

    const slice = { path, color, labelX, labelY, percentage: (d.value / total) * 100 };
    currentAngle += sliceAngle;
    return slice;
  });

  return (
    <View style={[styles.container, containerStyle]}>
      {title && <Text style={styles.title}>{title}</Text>}
      <Svg width={width} height={height}>
        {slices.map((slice, index) => (
          <Path key={`slice-${index}`} d={slice.path} fill={slice.color} />
        ))}
      </Svg>
      {showLegend && (
        <View style={styles.legendContainer}>
          <FlatList
            data={data}
            keyExtractor={(_, index) => `legend-${index}`}
            renderItem={({ item, index }) => (
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendColor,
                    { backgroundColor: item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length] },
                  ]}
                />
                <Text style={styles.legendLabel}>{item.label}</Text>
                <Text style={styles.legendValue}>
                  {((item.value / total) * 100).toFixed(1)}%
                </Text>
              </View>
            )}
            scrollEnabled={false}
          />
        </View>
      )}
    </View>
  );
};

function createPiePath(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArc = endAngle - startAngle > 180 ? '1' : '0';

  return [
    'M',
    cx,
    cy,
    'L',
    start.x,
    start.y,
    'A',
    radius,
    radius,
    0,
    largeArc,
    0,
    end.x,
    end.y,
    'Z',
  ].join(' ');
}

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  legendContainer: {
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    paddingHorizontal: 8,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 8,
  },
  legendLabel: {
    flex: 1,
    fontSize: 12,
    color: '#333',
  },
  legendValue: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
  },
});
