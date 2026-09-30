/**
 * WaterfallChart - Sequential contribution waterfall chart component
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, Text } from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';

interface WaterfallItem {
  label: string;
  value: number;
  isTotal?: boolean;
}

interface WaterfallChartProps {
  data: WaterfallItem[];
  width?: number;
  height?: number;
  positiveColor?: string;
  negativeColor?: string;
  containerStyle?: ViewStyle;
  title?: string;
}

export const WaterfallChart: React.FC<WaterfallChartProps> = ({
  data,
  width = 300,
  height = 250,
  positiveColor = '#4CAF50',
  negativeColor = '#F44336',
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

  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  let runningTotal = 0;
  const bars: {
    label: string;
    x: number;
    y: number;
    barHeight: number;
    color: string;
    isTotal: boolean;
    value: number;
  }[] = [];

  data.forEach((item, index) => {
    const barWidth = chartWidth / data.length;
    const x = padding + index * barWidth + barWidth * 0.1;

    let barHeight: number;
    let y: number;
    let color: string;

    if (item.isTotal) {
      barHeight = Math.abs(runningTotal) * (chartHeight / Math.max(...data.map(d => Math.abs(d.value))));
      y = padding + chartHeight - barHeight;
      color = runningTotal >= 0 ? positiveColor : negativeColor;
    } else {
      const previousTotal = runningTotal;
      runningTotal += item.value;
      barHeight = Math.abs(item.value) * (chartHeight / Math.max(...data.map(d => Math.abs(d.value))));

      if (item.value >= 0) {
        y = padding + chartHeight - (previousTotal * chartHeight / Math.max(...data.map(d => Math.abs(d.value)))) - barHeight;
        color = positiveColor;
      } else {
        y = padding + chartHeight - (previousTotal * chartHeight / Math.max(...data.map(d => Math.abs(d.value))));
        color = negativeColor;
      }
    }

    bars.push({
      label: item.label,
      x,
      y,
      barHeight: Math.max(barHeight, 2),
      color,
      isTotal: item.isTotal || false,
      value: item.value,
    });
  });

  const barWidth = chartWidth / data.length * 0.8;

  return (
    <View style={[styles.container, containerStyle]}>
      {title && <Text style={styles.title}>{title}</Text>}
      <Svg width={width} height={height}>
        {/* Axis */}
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
        {bars.map((bar, index) => (
          <g key={`bar-${index}`}>
            <Rect
              x={bar.x}
              y={bar.y}
              width={barWidth}
              height={bar.barHeight}
              fill={bar.color}
              opacity={bar.isTotal ? 0.9 : 0.7}
              stroke={bar.color}
              strokeWidth="1"
            />
            <SvgText
              x={bar.x + barWidth / 2}
              y={height - padding + 20}
              fontSize="10"
              fill="#666"
              textAnchor="middle"
            >
              {bar.label}
            </SvgText>
          </g>
        ))}
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
