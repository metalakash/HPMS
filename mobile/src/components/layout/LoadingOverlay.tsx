/**
 * LoadingOverlay - Full screen loading indicator
 */

import React from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Modal,
  ViewStyle,
} from 'react-native';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  backgroundColor?: string;
  indicatorColor?: string;
  style?: ViewStyle;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  message,
  backgroundColor = 'rgba(0,0,0,0.5)',
  indicatorColor = '#1976d2',
  style,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
    >
      <View
        style={[
          styles.container,
          { backgroundColor },
          style,
        ]}
      >
        <ActivityIndicator
          size="large"
          color={indicatorColor}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
