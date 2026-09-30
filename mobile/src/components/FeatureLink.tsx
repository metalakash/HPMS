/**
 * Feature Link Component
 * Reusable badge showing connection between features
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface FeatureLinkProps {
  fromFeature: string;
  toFeature: string;
  linkCount: number;
  strength: 'weak' | 'medium' | 'strong';
  onPress?: () => void;
}

export const FeatureLink: React.FC<FeatureLinkProps> = ({
  fromFeature,
  toFeature,
  linkCount,
  strength,
  onPress,
}) => {
  const getStrengthWidth = (): string => {
    switch (strength) {
      case 'strong':
        return '3px';
      case 'medium':
        return '2px';
      case 'weak':
        return '1px';
      default:
        return '2px';
    }
  };

  const getStrengthColor = (): string => {
    switch (strength) {
      case 'strong':
        return '#4CAF50';
      case 'medium':
        return '#FF9800';
      case 'weak':
        return '#999';
      default:
        return '#757575';
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, { borderLeftWidth: parseInt(getStrengthWidth()) }]}
      onPress={onPress}
      testID={`feature-link-${fromFeature}-${toFeature}`}
    >
      <View style={styles.content}>
        <Text style={styles.linkText}>
          {fromFeature} → {toFeature}
        </Text>
        <Text style={styles.linkCount}>{linkCount} linked</Text>
      </View>
      <View
        style={[
          styles.strengthIndicator,
          {
            backgroundColor: getStrengthColor(),
            width: 8,
            height: 8,
            borderRadius: 4,
          },
        ]}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    borderLeftColor: '#2196F3',
  },
  content: {
    flex: 1,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  linkCount: {
    fontSize: 10,
    color: '#999',
  },
  strengthIndicator: {
    marginLeft: 8,
  },
});
