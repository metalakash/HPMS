/**
 * Spacer - Flexible spacing component
 */

import React from 'react';
import { View, ViewStyle } from 'react-native';

interface SpacerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  flex?: boolean;
  style?: ViewStyle;
}

const sizeMap = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const Spacer: React.FC<SpacerProps> = ({
  size = 'md',
  flex = false,
  style,
}) => {
  const spacing = sizeMap[size];

  return (
    <View
      style={[
        {
          height: spacing,
          width: spacing,
        },
        flex && { flex: 1 },
        style,
      ]}
    />
  );
};
