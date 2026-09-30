/**
 * Select - Dropdown/picker component
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  StyleSheet,
  ViewStyle,
} from 'react-native';

interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectProps {
  label?: string;
  options: SelectOption[];
  value?: string | number;
  onValueChange?: (value: string | number) => void;
  placeholder?: string;
  error?: string;
  containerStyle?: ViewStyle;
  required?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  label,
  options,
  value,
  onValueChange,
  placeholder = 'Select an option',
  error,
  containerStyle,
  required,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const selectedLabel = options.find(opt => opt.value === value)?.label || placeholder;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}

      <Pressable
        onPress={() => setIsOpen(true)}
        style={[
          styles.trigger,
          error && styles.triggerError,
        ]}
      >
        <Text
          style={[
            styles.triggerText,
            !value && styles.placeholder,
          ]}
        >
          {selectedLabel}
        </Text>
        <Text style={styles.arrow}>▼</Text>
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setIsOpen(false)}
        >
          <View style={styles.modalContent}>
            <FlatList
              data={options}
              keyExtractor={(item) => String(item.value)}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onValueChange?.(item.value);
                    setIsOpen(false);
                  }}
                  style={[
                    styles.option,
                    value === item.value && styles.selectedOption,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      value === item.value && styles.selectedText,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
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
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  triggerError: {
    borderColor: '#f44336',
    backgroundColor: '#ffebee',
  },
  triggerText: {
    fontSize: 14,
    color: '#000',
  },
  placeholder: {
    color: '#999',
  },
  arrow: {
    fontSize: 10,
    color: '#666',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '60%',
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedOption: {
    backgroundColor: '#f5f9ff',
  },
  optionText: {
    fontSize: 14,
    color: '#333',
  },
  selectedText: {
    color: '#1976d2',
    fontWeight: '600',
  },
  error: {
    fontSize: 12,
    color: '#f44336',
    marginTop: 4,
  },
});
