/**
 * ListItem - Reusable list item component
 */

import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ViewStyle,
} from 'react-native';

interface ListItemProps {
  title: string;
  subtitle?: string;
  rightContent?: React.ReactNode;
  leftContent?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  divider?: boolean;
}

export const ListItem: React.FC<ListItemProps> = ({
  title,
  subtitle,
  rightContent,
  leftContent,
  onPress,
  style,
  divider = true,
}) => {
  const content = (
    <View style={[styles.container, style]}>
      {leftContent && (
        <View style={styles.leftContent}>
          {leftContent}
        </View>
      )}

      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && (
          <Text style={styles.subtitle}>{subtitle}</Text>
        )}
      </View>

      {rightContent && (
        <View style={styles.rightContent}>
          {rightContent}
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.pressable,
          pressed && styles.pressed,
        ]}
      >
        {content}
        {divider && <View style={styles.divider} />}
      </Pressable>
    );
  }

  return (
    <View>
      {content}
      {divider && <View style={styles.divider} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  pressable: {
    flex: 1,
  },
  pressed: {
    backgroundColor: '#f5f5f5',
  },
  leftContent: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  rightContent: {
    marginLeft: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
});
