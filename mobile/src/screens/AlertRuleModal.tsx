/**
 * Alert Rule Configuration Modal
 * Create and edit alert rules with triggers, conditions, and notifications
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';

interface AlertRuleModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (rule: any) => Promise<void>;
  rule?: any;
}

export const AlertRuleModal: React.FC<AlertRuleModalProps> = ({
  visible,
  onClose,
  onSave,
  rule,
}) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [trigger, setTrigger] = useState('covenant_breach');
  const [frequency, setFrequency] = useState('immediate');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);

  const triggers = [
    { value: 'covenant_breach', label: 'Covenant Breach', icon: '📑' },
    { value: 'metric_threshold', label: 'Metric Threshold', icon: '📊' },
    { value: 'status_change', label: 'Status Change', icon: '🔄' },
    { value: 'deadline_approaching', label: 'Deadline Approaching', icon: '⏰' },
    { value: 'approval_needed', label: 'Approval Needed', icon: '✓' },
  ];

  const frequencies = [
    { value: 'immediate', label: 'Immediate' },
    { value: 'daily', label: 'Daily Digest' },
    { value: 'weekly', label: 'Weekly Digest' },
  ];

  const recipients = [
    { id: 'me', label: 'Me (Current User)' },
    { id: 'team', label: 'My Team' },
    { id: 'admin', label: 'Admins' },
    { id: 'lender', label: 'Lender' },
  ];

  useEffect(() => {
    if (rule) {
      setName(rule.name);
      setDescription(rule.description || '');
      setEnabled(rule.enabled);
      setTrigger(rule.trigger);
      setFrequency(rule.notification?.frequency || 'immediate');
      setSelectedRecipients(rule.notification?.recipients || []);
    } else {
      resetForm();
    }
  }, [rule, visible]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setEnabled(true);
    setTrigger('covenant_breach');
    setFrequency('immediate');
    setSelectedRecipients(['me']);
  };

  const validateForm = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a rule name');
      return false;
    }
    if (selectedRecipients.length === 0) {
      Alert.alert('Error', 'Please select at least one recipient');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const ruleData = {
        name,
        description,
        enabled,
        trigger,
        notification: {
          type: frequency === 'immediate' ? 'immediate' : 'digest',
          frequency: frequency === 'immediate' ? undefined : frequency,
          recipients: selectedRecipients,
        },
      };

      await onSave(ruleData);
      resetForm();
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to save alert rule');
    } finally {
      setLoading(false);
    }
  };

  const toggleRecipient = (recipientId: string) => {
    setSelectedRecipients(prev =>
      prev.includes(recipientId)
        ? prev.filter(id => id !== recipientId)
        : [...prev, recipientId]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{rule ? 'Edit Alert Rule' : 'New Alert Rule'}</Text>
          <View style={styles.closeButton} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentPadding}>
          {/* Basic Info */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Rule Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Covenant Breach Alert"
                value={name}
                onChangeText={setName}
                editable={!loading}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Optional description"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                editable={!loading}
              />
            </View>

            <View style={styles.enableRow}>
              <Text style={styles.label}>Enabled</Text>
              <Switch
                value={enabled}
                onValueChange={setEnabled}
                disabled={loading}
                trackColor={{ false: '#ccc', true: '#1976d2' }}
              />
            </View>
          </Card>

          {/* Trigger Selection */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Trigger Event</Text>
            <View style={styles.triggerGrid}>
              {triggers.map(t => (
                <TouchableOpacity
                  key={t.value}
                  style={[
                    styles.triggerButton,
                    trigger === t.value && styles.triggerButtonActive,
                  ]}
                  onPress={() => setTrigger(t.value)}
                  disabled={loading}
                >
                  <Text style={styles.triggerIcon}>{t.icon}</Text>
                  <Text
                    style={[
                      styles.triggerLabel,
                      trigger === t.value && styles.triggerLabelActive,
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {/* Notification Type */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Notification Type</Text>
            <View style={styles.frequencyOptions}>
              {frequencies.map(f => (
                <TouchableOpacity
                  key={f.value}
                  style={[
                    styles.frequencyButton,
                    frequency === f.value && styles.frequencyButtonActive,
                  ]}
                  onPress={() => setFrequency(f.value)}
                  disabled={loading}
                >
                  <Text
                    style={[
                      styles.frequencyText,
                      frequency === f.value && styles.frequencyTextActive,
                    ]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {/* Recipients */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Recipients</Text>
            <Text style={styles.label}>Who should receive this alert? *</Text>
            <View style={styles.recipientsList}>
              {recipients.map(recipient => (
                <TouchableOpacity
                  key={recipient.id}
                  style={styles.recipientItem}
                  onPress={() => toggleRecipient(recipient.id)}
                  disabled={loading}
                >
                  <View style={styles.checkbox}>
                    {selectedRecipients.includes(recipient.id) && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </View>
                  <Text style={styles.recipientLabel}>{recipient.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedRecipients.length > 0 && (
              <View style={styles.selectedRecipients}>
                <Text style={styles.selectedRecipientsLabel}>Selected:</Text>
                <View style={styles.badgeContainer}>
                  {selectedRecipients.map(id => {
                    const recipient = recipients.find(r => r.id === id);
                    return (
                      recipient && <Badge key={id} label={recipient.label} />
                    );
                  })}
                </View>
              </View>
            )}
          </Card>

          {/* Summary */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Rule:</Text>
              <Text style={styles.summaryValue}>{name || 'Unnamed'}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Triggers on:</Text>
              <Text style={styles.summaryValue}>
                {triggers.find(t => t.value === trigger)?.label}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Notifies:</Text>
              <Text style={styles.summaryValue}>
                {frequency === 'immediate'
                  ? 'Immediately'
                  : frequency === 'daily'
                  ? 'Daily Digest'
                  : 'Weekly Digest'}
              </Text>
            </View>
          </Card>

          {/* Test Button */}
          <Card style={styles.section}>
            <TouchableOpacity style={styles.testButton} disabled={loading}>
              <Text style={styles.testButtonText}>🧪 Test This Rule</Text>
            </TouchableOpacity>
          </Card>
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom }]}>
          <Button
            label="Cancel"
            onPress={onClose}
            style={styles.cancelButton}
            disabled={loading}
          />
          <Button
            label={rule ? 'Update Rule' : 'Create Rule'}
            onPress={handleSave}
            loading={loading}
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
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
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
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  formGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#212121',
    backgroundColor: '#fff',
  },
  multilineInput: {
    paddingVertical: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  enableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  triggerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  triggerButton: {
    flex: 1,
    minWidth: '48%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  triggerButtonActive: {
    backgroundColor: '#e3f2fd',
    borderColor: '#1976d2',
  },
  triggerIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  triggerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  triggerLabelActive: {
    color: '#1976d2',
  },
  frequencyOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  frequencyButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  frequencyButtonActive: {
    backgroundColor: '#1976d2',
    borderColor: '#1565c0',
  },
  frequencyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  frequencyTextActive: {
    color: '#fff',
  },
  recipientsList: {
    gap: 8,
    marginVertical: 12,
  },
  recipientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#1976d2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: '#f5f5f5',
  },
  checkmark: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1976d2',
  },
  recipientLabel: {
    fontSize: 14,
    color: '#212121',
    fontWeight: '500',
  },
  selectedRecipients: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  selectedRecipientsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#212121',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  testButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff3cd',
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  testButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#856404',
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
  cancelButton: {
    flex: 1,
    marginBottom: 0,
  },
});
