/**
 * Export Screen
 * Configure and execute data export
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

interface Feature {
  id: string;
  label: string;
  count: number;
  enabled: boolean;
}

interface ExportScreenProps {
  onExport?: (config: any) => void;
}

export const ExportScreen: React.FC<ExportScreenProps> = ({ onExport }) => {
  const [features, setFeatures] = useState<Feature[]>([
    { id: 'projects', label: 'Projects', count: 45, enabled: false },
    { id: 'inspections', label: 'Inspections', count: 128, enabled: false },
    { id: 'workorders', label: 'Work Orders', count: 67, enabled: false },
    { id: 'compliance', label: 'Compliance Records', count: 34, enabled: false },
    { id: 'reports', label: 'Reports', count: 12, enabled: false },
  ]);

  const [format, setFormat] = useState<'csv' | 'json' | 'excel' | 'pdf'>('csv');
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [recentExports, setRecentExports] = useState<any[]>([
    { id: '1', name: 'Projects Export', format: 'csv', size: '2.5 MB', date: '2 days ago' },
    { id: '2', name: 'Full Data Export', format: 'json', size: '8.1 MB', date: '5 days ago' },
  ]);

  const toggleFeature = useCallback((featureId: string) => {
    setFeatures(prev =>
      prev.map(f => (f.id === featureId ? { ...f, enabled: !f.enabled } : f))
    );
  }, []);

  const selectAll = useCallback(() => {
    setFeatures(prev => prev.map(f => ({ ...f, enabled: true })));
  }, []);

  const deselectAll = useCallback(() => {
    setFeatures(prev => prev.map(f => ({ ...f, enabled: false })));
  }, []);

  const handleExport = useCallback(() => {
    const selectedFeatures = features.filter(f => f.enabled).map(f => f.id);
    if (selectedFeatures.length === 0) {
      alert('Please select at least one feature to export');
      return;
    }

    setExporting(true);
    const config = {
      features: selectedFeatures,
      format,
      dateRange: { start: startDate, end: endDate },
      timestamp: new Date().toISOString(),
    };

    setTimeout(() => {
      setExporting(false);
      onExport?.(config);
    }, 1000);
  }, [features, format, startDate, endDate, onExport]);

  const getTotalSize = useCallback(() => {
    const selectedCount = features.filter(f => f.enabled).reduce((sum, f) => sum + f.count, 0);
    const estimatedSize = (selectedCount * 0.5).toFixed(1);
    return `${estimatedSize} MB`;
  }, [features]);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Select Features to Export</Text>

        <View style={styles.buttonGroup}>
          <TouchableOpacity style={styles.selectButton} onPress={selectAll}>
            <Text style={styles.selectButtonText}>Select All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.selectButton, styles.deselectButton]} onPress={deselectAll}>
            <Text style={styles.selectButtonText}>Deselect All</Text>
          </TouchableOpacity>
        </View>

        {features.map((feature, index) => (
          <View key={feature.id} style={[styles.featureItem, index % 2 === 0 && styles.alternateRow]}>
            <View style={styles.featureContent}>
              <Text style={styles.featureLabel}>{feature.label}</Text>
              <Text style={styles.featureCount}>{feature.count} records</Text>
            </View>
            <Switch
              value={feature.enabled}
              onValueChange={() => toggleFeature(feature.id)}
              trackColor={{ false: '#e0e0e0', true: '#81c784' }}
              thumbColor={feature.enabled ? '#388e3c' : '#bdbdbd'}
            />
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Export Format</Text>

        <View style={styles.formatGrid}>
          {['csv', 'json', 'excel', 'pdf'].map(fmt => (
            <TouchableOpacity
              key={fmt}
              style={[styles.formatButton, format === fmt && styles.formatButtonActive]}
              onPress={() => setFormat(fmt as any)}
            >
              <Text
                style={[
                  styles.formatText,
                  format === fmt && styles.formatTextActive,
                ]}
              >
                {fmt.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Date Range (Optional)</Text>

        <TouchableOpacity style={styles.dateButton} onPress={() => setShowStartPicker(true)}>
          <Text style={styles.dateButtonText}>
            Start: {startDate.toLocaleDateString()}
          </Text>
        </TouchableOpacity>

        {showStartPicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            display="default"
            onChange={(event, date) => {
              setShowStartPicker(false);
              if (date) setStartDate(date);
            }}
          />
        )}

        <TouchableOpacity style={styles.dateButton} onPress={() => setShowEndPicker(true)}>
          <Text style={styles.dateButtonText}>
            End: {endDate.toLocaleDateString()}
          </Text>
        </TouchableOpacity>

        {showEndPicker && (
          <DateTimePicker
            value={endDate}
            mode="date"
            display="default"
            onChange={(event, date) => {
              setShowEndPicker(false);
              if (date) setEndDate(date);
            }}
          />
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Export Summary</Text>
          <Text style={styles.summaryText}>
            Features: {features.filter(f => f.enabled).length}
          </Text>
          <Text style={styles.summaryText}>
            Records: {features.filter(f => f.enabled).reduce((sum, f) => sum + f.count, 0)}
          </Text>
          <Text style={styles.summaryText}>
            Estimated Size: {getTotalSize()}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.exportButton, exporting && styles.disabledButton]}
        onPress={handleExport}
        disabled={exporting}
      >
        <Text style={styles.exportButtonText}>
          {exporting ? 'Exporting...' : 'Export Data'}
        </Text>
      </TouchableOpacity>

      {recentExports.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Exports</Text>

          {recentExports.map(exp => (
            <View key={exp.id} style={styles.exportItem}>
              <View style={styles.exportInfo}>
                <Text style={styles.exportName}>{exp.name}</Text>
                <Text style={styles.exportMeta}>
                  {exp.format.toUpperCase()} • {exp.size} • {exp.date}
                </Text>
              </View>
              <View style={styles.exportActions}>
                <TouchableOpacity style={styles.actionIcon}>
                  <Text>📥</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionIcon}>
                  <Text>🔗</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionIcon}>
                  <Text>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 12,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  selectButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#388e3c',
    borderRadius: 4,
  },
  deselectButton: {
    backgroundColor: '#d32f2f',
  },
  selectButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  featureItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  alternateRow: {
    backgroundColor: '#fafafa',
  },
  featureContent: {
    flex: 1,
  },
  featureLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  featureCount: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  formatGrid: {
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
  },
  formatButtonActive: {
    borderColor: '#1976d2',
    backgroundColor: '#E3F2FD',
  },
  formatText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  formatTextActive: {
    color: '#1976d2',
  },
  dateButton: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 8,
  },
  dateButtonText: {
    fontSize: 14,
    color: '#212121',
  },
  summaryBox: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 4,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  exportButton: {
    backgroundColor: '#1976d2',
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 20,
  },
  disabledButton: {
    opacity: 0.6,
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  exportItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  exportInfo: {
    flex: 1,
  },
  exportName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  exportMeta: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  exportActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionIcon: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
});
