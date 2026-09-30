import React, { useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';

interface PhotoCaptureProps {
  onPhotoCapture: (uri: string) => void;
  onPhotoError?: (error: Error) => void;
}

export const PhotoCapture = ({ onPhotoCapture, onPhotoError }: PhotoCaptureProps) => {
  const cameraRef = useRef<any>(null);

  const handleCapture = async () => {
    try {
      // Camera capture logic would go here
      // For now, placeholder implementation
      const uri = `file://photo-${Date.now()}.jpg`;
      onPhotoCapture(uri);
    } catch (error) {
      onPhotoError?.(error as Error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.cameraPreview}>
        <TouchableOpacity
          style={styles.captureButton}
          onPress={handleCapture}
          testID="camera-capture-button"
        >
          <View style={styles.captureButtonInner} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cameraPreview: {
    flex: 1,
    backgroundColor: '#000',
    borderRadius: 8,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 20,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1976D2',
  },
});
