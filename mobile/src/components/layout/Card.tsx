/**
 * Card - Container component with shadow and styling
 */

import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  Pressable,
} from 'react-native';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  elevation?: number;
  backgroundColor?: string;
  borderRadius?: number;
  padding?: number;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  elevation = 2,
  backgroundColor = '#fff',
  borderRadius = 8,
  padding = 16,
}) => {
  const cardStyle = [
    styles.card,
    {
      backgroundColor,
      borderRadius,
      padding,
      elevation,
    },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          cardStyle,
          pressed && styles.pressed,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
};

interface CardHeaderProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  children,
  style,
}) => (
  <View style={[styles.header, style]}>
    {children}
  </View>
);

interface CardBodyProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const CardBody: React.FC<CardBodyProps> = ({
  children,
  style,
}) => (
  <View style={[styles.body, style]}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  card: {
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  pressed: {
    opacity: 0.95,
  },
  header: {
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 8,
  },
  body: {
    marginTop: 8,
  },
});
