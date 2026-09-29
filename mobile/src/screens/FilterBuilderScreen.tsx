/**
 * Filter Builder Screen
 * Interactive filter builder for creating complex filter combinations
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import { Button } from '../components/Button';

interface FilterCriterion {
  id: string;
  field: string;
  operator: string;
  value: any;
}

interface FilterBuilderScreenProps {
  feature: string;
  availableFields: any[];
  onSaveFilter: (name: string, description: string, filters: FilterCriterion[]) => void;
  onCancel: () => void;
}

export const FilterBuilderScreen: React.FC<FilterBuilderScreenProps> = ({
  feature,
  availableFields,
  onSaveFilter,
  onCancel,
}) => {
  const insets = useSafeAreaInsets();
  const [filters, setFilters] = useState<FilterCriterion[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [filterDescription, setFilterDescription] = useState('');

  const operators = ['equals', 'contains', 'range', 'greater_than', 'less_than'];

  const addFilter = useCallback(() => {
    const newFilter: FilterCriterion = {
      id: `filter-${Date.now()}`,
      field: availableFields[0]?.id || '',
      operator: 'equals',
      value: '',
    };
    setFilters(prev => [...prev, newFilter]);
  }, [availableFields]);

  const removeFilter = useCallback((id: string) => {
    setFilters(prev => prev.filter(f => f.id !== id));
  }, []);

  const updateFilter = useCallback(
    (id: string, updates: Partial<FilterCriterion>) => {
      setFilters(prev =>
        prev.map(f =>
          f.id === id ? { ...f, ...updates } : f
        )
      );
    },
    []
  );

  const handleSave = useCallback(() => {
    if (!filterName.trim()) {
      Alert.alert('Error', 'Please enter a filter name');
      return;
    }

    onSaveFilter(filterName, filterDescription, filters);
    setShowSaveDialog(false);
    setFilterName('');
    setFilterDescription('');
  }, [filterName, filterDescription, filters, onSaveFilter]);

  const renderFilterItem = (filter: FilterCriterion, index: number) => (
    <Card key={filter.id} style={styles.filterItem}>
      <View style={styles.filterItemHeader}>
        <Text style={styles.filterIndex}>{index + 1}</Text>
        <TouchableOpacity onPress={() => removeFilter(filter.id)}>
          <Text style={styles.removeButton}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        <Text style={styles.label}>Field</Text>
        <TouchableOpacity style={styles.select}>
          <Text style={styles.selectText}>{filter.field}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        <Text style={styles.label}>Operator</Text>
        <TouchableOpacity style={styles.select}>
          <Text style={styles.selectText}>{filter.operator}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        <Text style={styles.label}>Value</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter value"
          value={filter.value}
          onChangeText={(value) => updateFilter(filter.id, { value })}
        />
      </View>
    </Card>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Filter Builder</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentPadding}>
        {/* Feature Info */}
        <Card style={styles.info}>
          <Text style={styles.infoLabel}>Building filters for:</Text>
          <Text style={styles.infoValue}>{feature}</Text>
        </Card>

        {/* Current Filters */}
        {filters.length > 0 && (
          <View style={styles.filtersSection}>
            <Text style={styles.sectionTitle}>Applied Filters ({filters.length})</Text>
            {filters.map((filter, index) => renderFilterItem(filter, index))}
          </View>
        )}

        {/* Preview */}
        {filters.length > 0 && (
          <Card style={styles.preview}>
            <Text style={styles.previewTitle}>Preview</Text>
            <View style={styles.previewContent}>
              <Text style={styles.previewText}>
                {filters.map(f => `${f.field} ${f.operator} ${f.value}`).join(' AND ')}
              </Text>
            </View>
          </Card>
        )}

        {/* Empty State */}
        {filters.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyText}>No filters added yet</Text>
            <Text style={styles.emptySubtext}>Add filters to refine your search</Text>
          </View>
        )}

        {/* Preset Filters */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Templates</Text>
          <TouchableOpacity style={styles.template}>
            <Text style={styles.templateText}>📅 This Week</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.template}>
            <Text style={styles.templateText}>🔴 High Priority</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.template}>
            <Text style={styles.templateText}>✓ Completed</Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom }]}>
        <Button
          label="Add Filter"
          onPress={addFilter}
          style={styles.footerButton}
        />
        <Button
          label="Save Filter"
          onPress={() => setShowSaveDialog(true)}
          disabled={filters.length === 0}
          style={styles.footerButton}
        />
      </View>

      {/* Save Dialog */}
      <Modal visible={showSaveDialog} animationType="fade" transparent>
        <View style={styles.dialogOverlay}>
          <Card style={styles.dialog}>
            <Text style={styles.dialogTitle}>Save Filter</Text>

            <View style={styles.dialogField}>
              <Text style={styles.dialogLabel}>Filter Name *</Text>
              <TextInput
                style={styles.dialogInput}
                placeholder="e.g., High Priority Inspections"
                value={filterName}
                onChangeText={setFilterName}
              />
            </View>

            <View style={styles.dialogField}>
              <Text style={styles.dialogLabel}>Description</Text>
              <TextInput
                style={[styles.dialogInput, styles.multilineInput]}
                placeholder="Optional description"
                value={filterDescription}
                onChangeText={setFilterDescription}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.dialogActions}>
              <Button
                label="Cancel"
                onPress={() => setShowSaveDialog(false)}
                style={styles.dialogButton}
              />
              <Button
                label="Save"
                onPress={handleSave}
                style={styles.dialogButton}
              />
            </View>
          </Card>
        </View>
      </Modal>
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
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#666',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
  },
  content: {
    flex: 1,
  },
  contentPadding: {
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  info: {
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  filtersSection: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  filterItem: {
    marginBottom: 8,
  },
  filterItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterIndex: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1976d2',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e3f2fd',
    textAlign: 'center',
    lineHeight: 24,
  },
  removeButton: {
    fontSize: 18,
    color: '#d32f2f',
  },
  filterRow: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  select: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  selectText: {
    fontSize: 14,
    color: '#212121',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#212121',
  },
  preview: {
    marginBottom: 12,
    backgroundColor: '#f0f7ff',
    borderLeftWidth: 4,
    borderLeftColor: '#1976d2',
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 8,
  },
  previewContent: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 4,
  },
  previewText: {
    fontSize: 13,
    color: '#212121',
    fontFamily: 'monospace',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  section: {
    marginBottom: 12,
  },
  template: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#e3f2fd',
    marginBottom: 8,
  },
  templateText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1976d2',
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 8,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  footerButton: {
    flex: 1,
    marginBottom: 0,
  },
  dialogOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
  },
  dialog: {
    width: '100%',
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 16,
  },
  dialogField: {
    marginBottom: 12,
  },
  dialogLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  dialogInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#212121',
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  dialogButton: {
    flex: 1,
    marginBottom: 0,
  },
});
