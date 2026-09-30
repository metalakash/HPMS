import React, { useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';

interface SignaturePadProps {
  onSignatureCapture: (signatureData: string) => void;
  onClear?: () => void;
}

export const SignaturePad = ({ onSignatureCapture, onClear }: SignaturePadProps) => {
  const canvasRef = useRef<any>(null);
  const isDrawing = useRef(false);

  const handleStartDrawing = () => {
    isDrawing.current = true;
  };

  const handleEndDrawing = () => {
    isDrawing.current = false;
  };

  const handleSaveSignature = () => {
    if (canvasRef.current) {
      canvasRef.current.getSignatureAsBase64((data: string) => {
        onSignatureCapture(data);
      });
    }
  };

  const handleClearSignature = () => {
    if (canvasRef.current) {
      canvasRef.current.clearSignature();
      onClear?.();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.signaturePad}>
        {/* Signature canvas would be rendered here */}
        <View style={styles.placeholderCanvas} />
      </View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={handleClearSignature}
          testID="clear-signature-button"
        >
          <Text style={styles.buttonText}>Clear</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleSaveSignature}
          testID="save-signature-button"
        >
          <Text style={styles.buttonText}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  signaturePad: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  placeholderCanvas: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 4,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#1976D2',
  },
  buttonText: {
    fontWeight: '600',
    color: '#000',
  },
});
