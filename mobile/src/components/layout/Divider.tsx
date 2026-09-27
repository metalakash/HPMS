/**
 * Divider - Vertical or horizontal divider component
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  color?: string;
  thickness?: number;
  spacing?: number;
  style?: ViewStyle;
}

export const Divider: React.FC<DividerProps> = ({
  orientation = 'horizontal',
  color = '#f0f0f0',
  thickness = 1,
  spacing = 16,
  style,
}) => {
  const isHorizontal = orientation === 'horizontal';

  return (
    <View
      style={[
        isHorizontal ? styles.horizontal : styles.vertical,
        {
          backgroundColor: color,
          height: isHorizontal ? thickness : '100%',
          width: isHorizontal ? '100%' : thickness,
          marginVertical: isHorizontal ? spacing : 0,
          marginHorizontal: isHorizontal ? 0 : spacing,
        },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  horizontal: {},
  vertical: {},
});
