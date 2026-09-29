/**
 * Report Builder Screen
 * Interactive custom report builder for field selection and configuration
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  SectionList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import { Button } from '../components/Button';

interface ReportBuilderScreenProps {
  onGenerateReport?: (config: any) => void;
  onSaveTemplate?: (name: string, config: any) => void;
  onCancel?: () => void;
}

const AVAILABLE_FIELDS = {
  inspections: [
    { id: 'date', label: 'Date', type: 'date' },
    { id: 'type', label: 'Type', type: 'select' },
    { id: 'status', label: 'Status', type: 'select' },
    { id: 'priority', label: 'Priority', type: 'select' },
    { id: 'location', label: 'Location', type: 'text' },
    { id: 'inspector', label: 'Inspector', type: 'text' },
    { id: 'findings', label: 'Findings Count', type: 'number' },
    { id: 'duration', label: 'Duration (hours)', type: 'number' },
  ],
  maintenance: [
    { id: 'date', label: 'Date', type: 'date' },
    { id: 'type', label: 'Work Order Type', type: 'select' },
    { id: 'status', label: 'Status', type: 'select' },
    { id: 'cost', label: 'Cost', type: 'number' },
    { id: 'equipment', label: 'Equipment', type: 'text' },
    { id: 'technician', label: 'Technician', type: 'text' },
    { id: 'hours', label: 'Work Hours', type: 'number' },
    { id: 'completion_date', label: 'Completion Date', type: 'date' },
  ],
  documents: [
    { id: 'date', label: 'Upload Date', type: 'date' },
    { id: 'category', label: 'Category', type: 'select' },
    { id: 'type', label: 'File Type', type: 'select' },
    { id: 'size', label: 'File Size', type: 'number' },
    { id: 'name', label: 'Document Name', type: 'text' },
    { id: 'uploader', label: 'Uploaded By', type: 'text' },
  ],
};

export const ReportBuilderScreen: React.FC<ReportBuilderScreenProps> = ({
  onGenerateReport,
  onSaveTemplate,
  onCancel,
}) => {
  const insets = useSafeAreaInsets();
  const [selectedFeature, setSelectedFeature] = useState<'inspections' | 'maintenance' | 'documents'>('inspections');
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [includeStats, setIncludeStats] = useState(true);
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie' | 'none'>('bar');
  const [groupBy, setGroupBy] = useState<string>('');
  const [templateName, setTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  const handleToggleField = useCallback((fieldId: string) => {
    setSelectedFields(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fieldId)) {
        newSet.delete(fieldId);
      } else {
        newSet.add(fieldId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAllFields = useCallback(() => {
    const fields = AVAILABLE_FIELDS[selectedFeature];
    setSelectedFields(new Set(fields.map(f => f.id)));
  }, [selectedFeature]);

  const handleClearFields = useCallback(() => {
    setSelectedFields(new Set());
  }, []);

  const availableFields = AVAILABLE_FIELDS[selectedFeature];
  const chartTypes = ['bar', 'line', 'pie', 'none'] as const;

  const renderFieldSection = () => (
    <Card style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Fields ({selectedFields.size}/{availableFields.length})</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity onPress={handleSelectAllFields} style={styles.quickActionButton}>
            <Text style={styles.quickActionText}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClearFields} style={styles.quickActionButton}>
            <Text style={styles.quickActionText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      {availableFields.map(field => (
        <TouchableOpacity
          key={field.id}
          style={styles.fieldRow}
          onPress={() => handleToggleField(field.id)}
        >
          <View style={styles.fieldCheckbox}>
            {selectedFields.has(field.id) && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View style={styles.fieldInfo}>
            <Text style={styles.fieldLabel}>{field.label}</Text>
            <Text style={styles.fieldType}>{field.type}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </Card>
  );

  const renderFeatureSelector = () => (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>Report Type</Text>
      {(['inspections', 'maintenance', 'documents'] as const).map(feature => (
        <TouchableOpacity
          key={feature}
          style={[
            styles.featureOption,
            selectedFeature === feature && styles.featureOptionSelected,
          ]}
          onPress={() => {
            setSelectedFeature(feature);
            setSelectedFields(new Set());
          }}
        >
          <View style={styles.featureRadio}>
            {selectedFeature === feature && <View style={styles.featureRadioInner} />}
          </View>
          <Text style={styles.featureLabel}>
            {feature.charAt(0).toUpperCase() + feature.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </Card>
  );

  const renderFormattingOptions = () => (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>Formatting</Text>

      <View style={styles.optionRow}>
        <Text style={styles.optionLabel}>Include Statistics</Text>
        <Switch value={includeStats} onValueChange={setIncludeStats} />
      </View>

      <View style={styles.optionRow}>
        <Text style={styles.optionLabel}>Chart Type</Text>
        <View style={styles.chartTypeSelector}>
          {chartTypes.map(type => (
            <TouchableOpacity
              key={type}
              style={[
                styles.chartTypeButton,
                chartType === type && styles.chartTypeButtonActive,
              ]}
              onPress={() => setChartType(type)}
            >
              <Text style={[
                styles.chartTypeText,
                chartType === type && styles.chartTypeTextActive,
              ]}>
                {type === 'none' ? 'None' : type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.optionRow}>
        <Text style={styles.optionLabel}>Group By</Text>
        <TextInput
          style={styles.input}
          placeholder="Field name (e.g., 'date', 'status')"
          value={groupBy}
          onChangeText={setGroupBy}
          placeholderTextColor="#999"
        />
      </View>
    </Card>
  );

  const renderPreview = () => (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>Preview</Text>
      <View style={styles.previewContent}>
        <View style={styles.previewItem}>
          <Text style={styles.previewLabel}>Fields Selected</Text>
          <Text style={styles.previewValue}>{selectedFields.size}</Text>
        </View>
        <View style={styles.previewItem}>
          <Text style={styles.previewLabel}>Chart Type</Text>
          <Text style={styles.previewValue}>{chartType}</Text>
        </View>
        <View style={styles.previewItem}>
          <Text style={styles.previewLabel}>Statistics</Text>
          <Text style={styles.previewValue}>{includeStats ? 'Yes' : 'No'}</Text>
        </View>
      </View>
    </Card>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Build Report</Text>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {renderFeatureSelector()}
        {renderFieldSection()}
        {renderFormattingOptions()}
        {renderPreview()}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Save Template"
          onPress={() => setShowSaveTemplate(true)}
          style={[styles.footerButton, styles.secondaryButton]}
        />
        <Button
          label="Generate Report"
          onPress={() => onGenerateReport?.({
            feature: selectedFeature,
            fields: Array.from(selectedFields),
            includeStats,
            chartType,
            groupBy: groupBy || undefined,
          })}
          disabled={selectedFields.size === 0}
          style={styles.footerButton}
        />
      </View>

      {showSaveTemplate && (
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Save as Template</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Template name"
              value={templateName}
              onChangeText={setTemplateName}
              placeholderTextColor="#999"
            />
            <View style={styles.modalActions}>
              <Button
                label="Cancel"
                onPress={() => setShowSaveTemplate(false)}
                style={[styles.modalButton, styles.cancelButton]}
              />
              <Button
                label="Save"
                onPress={() => {
                  onSaveTemplate?.(templateName, {
                    feature: selectedFeature,
                    fields: Array.from(selectedFields),
                    includeStats,
                    chartType,
                    groupBy,
                  });
                  setShowSaveTemplate(false);
                }}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      )}
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212121',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
  },
  quickActionButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#E3F2FD',
    borderRadius: 4,
  },
  quickActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1976d2',
  },
  featureOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  featureOptionSelected: {
    backgroundColor: '#E3F2FD',
  },
  featureRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#1976d2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1976d2',
  },
  featureLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  fieldCheckbox: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: '#1976d2',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkmark: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1976d2',
  },
  fieldInfo: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212121',
  },
  fieldType: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  optionRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  chartTypeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  chartTypeButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  chartTypeButtonActive: {
    backgroundColor: '#1976d2',
  },
  chartTypeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  chartTypeTextActive: {
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#212121',
    backgroundColor: '#f5f5f5',
    flex: 1,
  },
  previewContent: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 12,
  },
  previewItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
  },
  previewLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
  },
  previewValue: {
    fontSize: 14,
    fontWeight: '700',
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
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '85%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#212121',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
  },
  modalButton: {
    flex: 1,
    marginBottom: 0,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
});
