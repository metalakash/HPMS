/**
 * Export Format Selector Component
 * Format selection with info tooltips
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

type ExportFormat = 'csv' | 'json' | 'excel' | 'pdf';

interface ExportFormatSelectorProps {
  selected: ExportFormat;
  onSelect: (format: ExportFormat) => void;
}

export const ExportFormatSelector: React.FC<ExportFormatSelectorProps> = ({
  selected,
  onSelect,
}) => {
  const formats = [
    {
      id: 'csv' as ExportFormat,
      label: 'CSV',
      icon: '📊',
      description: 'Spreadsheet format',
      sizeFactor: 0.5,
    },
    {
      id: 'json' as ExportFormat,
      label: 'JSON',
      icon: '{}',
      description: 'Structured data',
      sizeFactor: 0.8,
    },
    {
      id: 'excel' as ExportFormat,
      label: 'Excel',
      icon: '📑',
      description: 'Formatted sheets',
      sizeFactor: 1.2,
    },
    {
      id: 'pdf' as ExportFormat,
      label: 'PDF',
      icon: '📄',
      description: 'Formatted report',
      sizeFactor: 2.0,
    },
  ];

  return (
    <View style={styles.container}>
      {formats.map(format => (
        <TouchableOpacity
          key={format.id}
          style={[
            styles.formatButton,
            selected === format.id && styles.formatButtonActive,
          ]}
          onPress={() => onSelect(format.id)}
        >
          <Text style={styles.icon}>{format.icon}</Text>
          <Text
            style={[
              styles.label,
              selected === format.id && styles.labelActive,
            ]}
          >
            {format.label}
          </Text>
          <Text
            style={[
              styles.description,
              selected === format.id && styles.descriptionActive,
            ]}
          >
            {format.description}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
  },
  formatButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    alignItems: 'center',
  },
  formatButtonActive: {
    borderColor: '#1976d2',
    backgroundColor: '#E3F2FD',
  },
  icon: {
    fontSize: 24,
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 2,
  },
  labelActive: {
    color: '#1976d2',
  },
  description: {
    fontSize: 10,
    color: '#999',
  },
  descriptionActive: {
    color: '#1976d2',
  },
});
