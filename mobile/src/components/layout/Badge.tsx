/**
 * Badge - Status indicator with color variants
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';

type BadgeVariant = 'primary' | 'success' | 'warning' | 'error' | 'neutral';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
  size?: 'sm' | 'md' | 'lg';
}

const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
  primary: { bg: '#1976d2', text: '#fff' },
  success: { bg: '#4caf50', text: '#fff' },
  warning: { bg: '#ff9800', text: '#fff' },
  error: { bg: '#f44336', text: '#fff' },
  neutral: { bg: '#e0e0e0', text: '#333' },
};

const sizeStyles = {
  sm: { paddingHorizontal: 8, paddingVertical: 4, fontSize: 11 },
  md: { paddingHorizontal: 12, paddingVertical: 6, fontSize: 12 },
  lg: { paddingHorizontal: 16, paddingVertical: 8, fontSize: 14 },
};

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'primary',
  style,
  size = 'md',
}) => {
  const colors = variantColors[variant];
  const sizeStyle = sizeStyles[size];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.bg,
          paddingHorizontal: sizeStyle.paddingHorizontal,
          paddingVertical: sizeStyle.paddingVertical,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: colors.text,
            fontSize: sizeStyle.fontSize,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '600',
  },
});
