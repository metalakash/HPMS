/**
 * ScreenContainer - Safe area wrapper for screens
 * Handles status bar, notches, and screen padding
 */

import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  StyleSheet,
  ViewStyle,
} from 'react-native';

interface ScreenContainerProps {
  children: React.ReactNode;
  scrollable?: boolean;
  backgroundColor?: string;
  paddingHorizontal?: number;
  paddingVertical?: number;
  style?: ViewStyle;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({
  children,
  scrollable = false,
  backgroundColor = '#fff',
  paddingHorizontal = 16,
  paddingVertical = 8,
  style,
}) => {
  const containerStyle = [
    styles.container,
    { backgroundColor, paddingHorizontal, paddingVertical },
    style,
  ];

  if (scrollable) {
    return (
      <SafeAreaView style={containerStyle}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={containerStyle}>
      {children}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
