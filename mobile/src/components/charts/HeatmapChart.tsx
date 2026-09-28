/**
 * HeatmapChart - Color-coded matrix heatmap component
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, Text, FlatList } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

interface HeatmapCell {
  x: number;
  y: number;
  value: number;
  label?: string;
}

interface HeatmapChartProps {
  data: HeatmapCell[];
  rows: number;
  cols: number;
  width?: number;
  height?: number;
  containerStyle?: ViewStyle;
  title?: string;
  minValue?: number;
  maxValue?: number;
  colorScheme?: 'blues' | 'greens' | 'reds' | 'viridis';
}

const getColor = (value: number, min: number, max: number, scheme: string): string => {
  const normalized = (value - min) / (max - min);

  const colorSchemes: { [key: string]: string[] } = {
    blues: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'],
    greens: ['#f7fcfd', '#e5f5f9', '#ccece6', '#99d8c9', '#66c2a4', '#41ae76', '#238b45', '#006d2c', '#00441b'],
    reds: ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#a50f15', '#67000d'],
    viridis: ['#440154', '#482777', '#3b528b', '#2d708e', '#29838e', '#22a884', '#5ec962', '#b5de2b', '#fde724'],
  };

  const colors = colorSchemes[scheme] || colorSchemes.blues;
  const index = Math.floor(normalized * (colors.length - 1));
  return colors[Math.min(index, colors.length - 1)];
};

export const HeatmapChart: React.FC<HeatmapChartProps> = ({
  data,
  rows,
  cols,
  width = 300,
  height = 250,
  containerStyle,
  title,
  minValue = 0,
  maxValue = 100,
  colorScheme = 'blues',
}) => {
  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, containerStyle]}>
        <Text style={styles.emptyText}>No data</Text>
      </View>
    );
  }

  const padding = 20;
  const cellWidth = (width - padding * 2) / cols;
  const cellHeight = (height - padding * 2) / rows;

  return (
    <View style={[styles.container, containerStyle]}>
      {title && <Text style={styles.title}>{title}</Text>}
      <Svg width={width} height={height}>
        {data.map((cell, index) => {
          const x = padding + cell.x * cellWidth;
          const y = padding + cell.y * cellHeight;
          const color = getColor(cell.value, minValue, maxValue, colorScheme);

          return (
            <g key={`cell-${index}`}>
              <Rect
                x={x}
                y={y}
                width={cellWidth}
                height={cellHeight}
                fill={color}
                stroke="#fff"
                strokeWidth="1"
              />
              {cell.label && (
                <SvgText
                  x={x + cellWidth / 2}
                  y={y + cellHeight / 2 + 3}
                  fontSize="10"
                  fill="#333"
                  textAnchor="middle"
                  opacity="0.7"
                >
                  {cell.value}
                </SvgText>
              )}
            </g>
          );
        })}
      </Svg>
      <View style={styles.legendContainer}>
        <Text style={styles.legendText}>
          {minValue} - {maxValue}
        </Text>
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
  legendContainer: {
    marginTop: 12,
    paddingHorizontal: 8,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
});
