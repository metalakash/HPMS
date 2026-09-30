/**
 * TextInput - Text input component with validation
 */

import React, { useState } from 'react';
import {
  View,
  TextInput as RNTextInput,
  Text,
  StyleSheet,
  ViewStyle,
  TextInputProps as RNTextInputProps,
} from 'react-native';

interface TextInputProps extends Omit<RNTextInputProps, 'style'> {
  label?: string;
  placeholder?: string;
  error?: string;
  helper?: string;
  required?: boolean;
  containerStyle?: ViewStyle;
  inputStyle?: ViewStyle;
  onChangeText?: (text: string) => void;
}

export const TextInput: React.FC<TextInputProps> = ({
  label,
  placeholder,
  error,
  helper,
  required,
  containerStyle,
  inputStyle,
  onChangeText,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      <RNTextInput
        placeholder={placeholder}
        placeholderTextColor="#999"
        onChangeText={onChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={[
          styles.input,
          isFocused && styles.inputFocused,
          error && styles.inputError,
          inputStyle,
        ]}
        {...props}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      {helper && !error && (
        <Text style={styles.helper}>{helper}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  required: {
    color: '#f44336',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#000',
  },
  inputFocused: {
    borderColor: '#1976d2',
    backgroundColor: '#f5f9ff',
  },
  inputError: {
    borderColor: '#f44336',
    backgroundColor: '#ffebee',
  },
  error: {
    fontSize: 12,
    color: '#f44336',
    marginTop: 4,
  },
  helper: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
});
