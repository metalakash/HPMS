/**
 * Report Preview Screen
 * Preview report before generation/export
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import { Button } from '../components/Button';

interface ReportData {
  summary: {
    totalRecords: number;
    filteredCount: number;
    averageValue?: number;
  };
  preview: any[];
}

interface ReportPreviewScreenProps {
  reportData?: ReportData;
  reportConfig?: any;
  onGenerate?: (format: string) => void;
  onSchedule?: () => void;
  onExport?: (format: string) => void;
  onCancel?: () => void;
}

export const ReportPreviewScreen: React.FC<ReportPreviewScreenProps> = ({
  reportData = {
    summary: { totalRecords: 245, filteredCount: 189, averageValue: 4.2 },
    preview: [
      { id: 1, date: '2026-09-28', type: 'Routine', status: 'Completed', value: 4.5 },
      { id: 2, date: '2026-09-27', type: 'Special', status: 'In Progress', value: 3.8 },
      { id: 3, date: '2026-09-26', type: 'Follow-up', status: 'Pending', value: 4.2 },
    ],
  },
  reportConfig = {},
  onGenerate,
  onSchedule,
  onExport,
  onCancel,
}) => {
  const insets = useSafeAreaInsets();
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'excel' | 'csv' | 'json'>('pdf');

  const exportFormats = [
    { id: 'pdf', label: 'PDF', icon: '📄' },
    { id: 'excel', label: 'Excel', icon: '📊' },
    { id: 'csv', label: 'CSV', icon: '📋' },
    { id: 'json', label: 'JSON', icon: '{}' },
  ];

  const renderSummary = () => (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>Summary</Text>
      <View style={styles.summaryGrid}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total Records</Text>
          <Text style={styles.summaryValue}>{reportData.summary.totalRecords}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Filtered</Text>
          <Text style={styles.summaryValue}>{reportData.summary.filteredCount}</Text>
        </View>
        {reportData.summary.averageValue && (
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Average</Text>
            <Text style={styles.summaryValue}>{reportData.summary.averageValue}</Text>
          </View>
        )}
      </View>
    </Card>
  );

  const renderDataPreview = () => (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>Data Preview (First 3 rows)</Text>
      {reportData.preview.map((row, index) => (
        <View key={index} style={styles.dataRow}>
          {Object.entries(row).map(([key, value]) => (
            <View key={key} style={styles.dataCell}>
              <Text style={styles.dataCellLabel}>{key}</Text>
              <Text style={styles.dataCellValue}>{String(value)}</Text>
            </View>
          ))}
        </View>
      ))}
    </Card>
  );

  const renderFormatSelection = () => (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>Export Format</Text>
      <View style={styles.formatGrid}>
        {exportFormats.map(format => (
          <TouchableOpacity
            key={format.id}
            style={[
              styles.formatButton,
              selectedFormat === format.id && styles.formatButtonActive,
            ]}
            onPress={() => setSelectedFormat(format.id as any)}
          >
            <Text style={styles.formatIcon}>{format.icon}</Text>
            <Text style={[
              styles.formatLabel,
              selectedFormat === format.id && styles.formatLabelActive,
            ]}>
              {format.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Card>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Report Preview</Text>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {renderSummary()}
        {renderDataPreview()}
        {renderFormatSelection()}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Schedule"
          onPress={onSchedule}
          style={[styles.footerButton, styles.secondaryButton]}
        />
        <Button
          label="Generate"
          onPress={() => onGenerate?.(selectedFormat)}
          style={styles.footerButton}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
  },
  closeButton: {
    fontSize: 24,
    color: '#999',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 8,
    paddingVertical: 12,
    gap: 12,
  },
  section: {
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212121',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1976d2',
  },
  dataRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dataCell: {
    marginBottom: 8,
  },
  dataCellLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
  },
  dataCellValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#212121',
  },
  formatGrid: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
    flexWrap: 'wrap',
  },
  formatButton: {
    flex: 0.45,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  formatButtonActive: {
    backgroundColor: '#E3F2FD',
    borderColor: '#1976d2',
  },
  formatIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  formatLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  formatLabelActive: {
    color: '#1976d2',
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  footerButton: {
    flex: 1,
    marginBottom: 0,
  },
  secondaryButton: {
    backgroundColor: '#f0f0f0',
  },
});
