/**
 * Bulk Actions Modal
 * Choose which bulk operation to perform on selected items
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import { Button } from '../components/Button';

type BulkActionType = 'update' | 'delete' | 'archive' | 'restore' | 'export' | 'duplicate';

interface BulkAction {
  id: BulkActionType;
  label: string;
  icon: string;
  description: string;
  enabled: boolean;
  color: string;
}

interface BulkActionsModalProps {
  visible: boolean;
  selectedCount: number;
  onActionSelect: (action: BulkActionType, config?: Record<string, any>) => void;
  onClose: () => void;
  availableActions?: BulkActionType[];
}

export const BulkActionsModal: React.FC<BulkActionsModalProps> = ({
  visible,
  selectedCount,
  onActionSelect,
  onClose,
  availableActions = ['update', 'delete', 'archive', 'restore', 'export', 'duplicate'],
}) => {
  const insets = useSafeAreaInsets();
  const [selectedAction, setSelectedAction] = useState<BulkActionType | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<Record<string, any>>({});

  const bulkActions: BulkAction[] = [
    {
      id: 'update',
      label: 'Update',
      icon: '✏️',
      description: 'Update fields across items',
      enabled: availableActions.includes('update'),
      color: '#1976d2',
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: '🗑️',
      description: 'Permanently delete items',
      enabled: availableActions.includes('delete'),
      color: '#d32f2f',
    },
    {
      id: 'archive',
      label: 'Archive',
      icon: '📦',
      description: 'Archive for later reference',
      enabled: availableActions.includes('archive'),
      color: '#f57c00',
    },
    {
      id: 'restore',
      label: 'Restore',
      icon: '↩️',
      description: 'Restore archived items',
      enabled: availableActions.includes('restore'),
      color: '#388e3c',
    },
    {
      id: 'export',
      label: 'Export',
      icon: '📥',
      description: 'Export as CSV/JSON/Excel',
      enabled: availableActions.includes('export'),
      color: '#7b1fa2',
    },
    {
      id: 'duplicate',
      label: 'Duplicate',
      icon: '📋',
      description: 'Create copies of items',
      enabled: availableActions.includes('duplicate'),
      color: '#0097a7',
    },
  ];

  const handleActionSelect = useCallback((action: BulkActionType) => {
    setSelectedAction(action);
    setShowConfig(true);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!selectedAction) return;

    if (selectedAction === 'delete') {
      Alert.alert(
        'Confirm Delete',
        `Are you sure you want to permanently delete ${selectedCount} item${selectedCount !== 1 ? 's' : ''}? This action cannot be undone.`,
        [
          { text: 'Cancel', onPress: () => {} },
          {
            text: 'Delete',
            onPress: () => {
              onActionSelect(selectedAction, config);
              resetAndClose();
            },
            style: 'destructive',
          },
        ]
      );
    } else {
      onActionSelect(selectedAction, config);
      resetAndClose();
    }
  }, [selectedAction, selectedCount, config, onActionSelect]);

  const resetAndClose = () => {
    setSelectedAction(null);
    setShowConfig(false);
    setConfig({});
    onClose();
  };

  const renderActionGrid = () => (
    <ScrollView contentContainerStyle={styles.actionGrid}>
      {bulkActions.map(action => (
        <TouchableOpacity
          key={action.id}
          style={[
            styles.actionButton,
            !action.enabled && styles.actionButtonDisabled,
          ]}
          onPress={() => handleActionSelect(action.id)}
          disabled={!action.enabled}
        >
          <Text style={styles.actionIcon}>{action.icon}</Text>
          <Text style={styles.actionLabel}>{action.label}</Text>
          <Text style={styles.actionDescription}>{action.description}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderConfig = () => {
    switch (selectedAction) {
      case 'update':
        return (
          <View style={styles.configContainer}>
            <Text style={styles.configTitle}>Update Configuration</Text>
            <View style={styles.configField}>
              <Text style={styles.label}>Field to Update</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., status"
                value={config.field || ''}
                onChangeText={text => setConfig({ ...config, field: text })}
                placeholderTextColor="#999"
              />
            </View>
            <View style={styles.configField}>
              <Text style={styles.label}>New Value</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., completed"
                value={config.value || ''}
                onChangeText={text => setConfig({ ...config, value: text })}
                placeholderTextColor="#999"
              />
            </View>
          </View>
        );

      case 'archive':
        return (
          <View style={styles.configContainer}>
            <Text style={styles.configTitle}>Archive Configuration</Text>
            <View style={styles.configField}>
              <Text style={styles.label}>Archive Reason (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Why are you archiving these items?"
                value={config.reason || ''}
                onChangeText={text => setConfig({ ...config, reason: text })}
                multiline
                numberOfLines={4}
                placeholderTextColor="#999"
              />
            </View>
          </View>
        );

      case 'export':
        return (
          <View style={styles.configContainer}>
            <Text style={styles.configTitle}>Export Configuration</Text>
            <View style={styles.configField}>
              <Text style={styles.label}>Export Format</Text>
              <View style={styles.formatButtons}>
                {(['csv', 'json', 'excel'] as const).map(format => (
                  <TouchableOpacity
                    key={format}
                    style={[
                      styles.formatButton,
                      config.format === format && styles.formatButtonActive,
                    ]}
                    onPress={() => setConfig({ ...config, format })}
                  >
                    <Text style={[
                      styles.formatButtonText,
                      config.format === format && styles.formatButtonTextActive,
                    ]}>
                      {format.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        );

      case 'duplicate':
        return (
          <View style={styles.configContainer}>
            <Text style={styles.configTitle}>Duplicate Configuration</Text>
            <View style={styles.configField}>
              <Text style={styles.label}>Number of Copies</Text>
              <TextInput
                style={styles.input}
                placeholder="1-10"
                value={config.count?.toString() || '1'}
                onChangeText={text => setConfig({ ...config, count: parseInt(text, 10) || 1 })}
                keyboardType="number-pad"
                placeholderTextColor="#999"
              />
            </View>
          </View>
        );

      case 'delete':
      case 'restore':
      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {showConfig ? 'Configure Action' : 'Bulk Actions'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Content */}
        {showConfig && selectedAction ? (
          <View style={styles.content}>
            <View style={styles.configHeader}>
              <TouchableOpacity onPress={() => setShowConfig(false)}>
                <Text style={styles.backButton}>← Back</Text>
              </TouchableOpacity>
              <Text style={styles.actionTitle}>
                {bulkActions.find(a => a.id === selectedAction)?.label}
              </Text>
              <View style={{ width: 50 }} />
            </View>
            {renderConfig()}
          </View>
        ) : (
          <View style={styles.content}>
            <Text style={styles.subtitle}>
              Select an action for {selectedCount} item{selectedCount !== 1 ? 's' : ''}
            </Text>
            {renderActionGrid()}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          {showConfig && (
            <Button
              label="Confirm"
              onPress={handleConfirm}
              style={styles.confirmButton}
            />
          )}
          <Button
            label={showConfig ? 'Back' : 'Cancel'}
            onPress={showConfig ? () => setShowConfig(false) : onClose}
            style={[styles.confirmButton, styles.cancelButton]}
          />
        </View>
      </View>
    </Modal>
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
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
  },
  closeButton: {
    fontSize: 24,
    color: '#999',
    fontWeight: '600',
    width: 40,
  },
  content: {
    flex: 1,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  actionButton: {
    width: '48%',
    margin: '1%',
    paddingVertical: 20,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
  },
  configHeader: {
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
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '600',
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212121',
  },
  configContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    marginTop: 8,
    marginHorizontal: 8,
    borderRadius: 8,
  },
  configTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 16,
  },
  configField: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#212121',
    backgroundColor: '#f5f5f5',
  },
  textArea: {
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  formatButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  formatButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  formatButtonActive: {
    borderColor: '#1976d2',
    backgroundColor: '#E3F2FD',
  },
  formatButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  formatButtonTextActive: {
    color: '#1976d2',
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  confirmButton: {
    flex: 1,
    marginBottom: 0,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
});
