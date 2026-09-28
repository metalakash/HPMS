/**
 * GaugeChart - Circular progress gauge chart component
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, Text } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

interface GaugeChartProps {
  value: number;
  maxValue?: number;
  width?: number;
  height?: number;
  color?: string;
  backgroundColor?: string;
  containerStyle?: ViewStyle;
  title?: string;
  unit?: string;
}

export const GaugeChart: React.FC<GaugeChartProps> = ({
  value,
  maxValue = 100,
  width = 200,
  height = 200,
  color = '#1976d2',
  backgroundColor = '#e0e0e0',
  containerStyle,
  title,
  unit = '%',
}) => {
  const radius = Math.min(width, height) / 2 - 20;
  const cx = width / 2;
  const cy = height / 2;

  const percentage = Math.min(Math.max(value / maxValue, 0), 1);
  const angle = percentage * 270 - 135;
  const radians = (angle * Math.PI) / 180;

  const x = cx + radius * Math.cos(radians);
  const y = cy + radius * Math.sin(radians);

  const startAngle = -135;
  const endAngle = startAngle + 270 * percentage;

  const arcPath = describeArc(cx, cy, radius, startAngle, endAngle);

  return (
    <View style={[styles.container, containerStyle]}>
      {title && <Text style={styles.title}>{title}</Text>}
      <Svg width={width} height={height}>
        {/* Background arc */}
        <Path
          d={describeArc(cx, cy, radius, -135, 135)}
          stroke={backgroundColor}
          strokeWidth="8"
          fill="none"
        />
        {/* Value arc */}
        <Path
          d={arcPath}
          stroke={color}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
        />
        {/* Center circle */}
        <Circle cx={cx} cy={cy} r="40" fill="#ffffff" stroke={backgroundColor} strokeWidth="2" />
      </Svg>
      <View style={styles.valueContainer}>
        <Text style={styles.valueText}>
          {Math.round(value)}{unit}
        </Text>
        <Text style={styles.maxText}>of {maxValue}{unit}</Text>
      </View>
    </View>
  );
};

function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    'M',
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
    alignItems: 'center',
    marginVertical: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  valueContainer: {
    alignItems: 'center',
    marginTop: -40,
  },
  valueText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1976d2',
  },
  maxText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
});
