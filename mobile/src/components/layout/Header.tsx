/**
 * Header - Top navigation bar component
 */

import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ViewStyle,
} from 'react-native';

interface HeaderProps {
  title: string;
  subtitle?: string;
  leftAction?: {
    label?: string;
    icon?: React.ReactNode;
    onPress: () => void;
  };
  rightAction?: {
    label?: string;
    icon?: React.ReactNode;
    onPress: () => void;
  };
  backgroundColor?: string;
  style?: ViewStyle;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  leftAction,
  rightAction,
  backgroundColor = '#1976d2',
  style,
}) => {
  return (
    <View
      style={[
        styles.header,
        { backgroundColor },
        style,
      ]}
    >
      <View style={styles.leftSection}>
        {leftAction && (
          <Pressable
            onPress={leftAction.onPress}
            style={styles.action}
          >
            {leftAction.icon ? (
              leftAction.icon
            ) : (
              <Text style={styles.actionText}>
                {leftAction.label || 'Back'}
              </Text>
            )}
          </Pressable>
        )}
      </View>

      <View style={styles.titleSection}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && (
          <Text style={styles.subtitle}>{subtitle}</Text>
        )}
      </View>

      <View style={styles.rightSection}>
        {rightAction && (
          <Pressable
            onPress={rightAction.onPress}
            style={styles.action}
          >
            {rightAction.icon ? (
              rightAction.icon
            ) : (
              <Text style={styles.actionText}>
                {rightAction.label || 'Menu'}
              </Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 4,
  },
  leftSection: {
    flex: 0.15,
  },
  titleSection: {
    flex: 0.7,
    alignItems: 'center',
  },
  rightSection: {
    flex: 0.15,
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  action: {
    padding: 8,
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
