/**
 * Checkbox - Checkbox input component
 */

import React from 'react';
import {
  View,
  Pressable,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';

interface CheckboxProps {
  label?: string;
  checked?: boolean;
  onToggle?: (checked: boolean) => void;
  containerStyle?: ViewStyle;
  disabled?: boolean;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  checked = false,
  onToggle,
  containerStyle,
  disabled = false,
}) => {
  const handlePress = () => {
    if (!disabled) {
      onToggle?.(!checked);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      style={[styles.container, containerStyle]}
      disabled={disabled}
    >
      <View
        style={[
          styles.checkbox,
          checked && styles.checked,
          disabled && styles.disabled,
        ]}
      >
        {checked && <Text style={styles.checkmark}>✓</Text>}
      </View>
      {label && (
        <Text
          style={[
            styles.label,
            disabled && styles.disabledLabel,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checked: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  disabledLabel: {
    color: '#999',
  },
});
