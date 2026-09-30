/**
 * Report Generator Modal
 * Configure report generation and export options
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import { Button } from '../components/Button';

interface ReportGeneratorModalProps {
  visible: boolean;
  selectedFormat: string;
  onGenerate: (config: any) => void;
  onSchedule: (config: any) => void;
  onCancel: () => void;
}

export const ReportGeneratorModal: React.FC<ReportGeneratorModalProps> = ({
  visible,
  selectedFormat,
  onGenerate,
  onSchedule,
  onCancel,
}) => {
  const insets = useSafeAreaInsets();
  const [reportName, setReportName] = useState('Report_' + new Date().toISOString().split('T')[0]);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [emailDelivery, setEmailDelivery] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState('');
  const [includeCharts, setIncludeCharts] = useState(true);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [compression, setCompression] = useState<'low' | 'medium' | 'high'>('medium');

  const frequencies = [
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
  ];

  const compressions = [
    { id: 'low', label: 'Low (Larger file)' },
    { id: 'medium', label: 'Medium (Balanced)' },
    { id: 'high', label: 'High (Smaller file)' },
  ];

  const renderBasicSettings = () => (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>Report Settings</Text>

      <View style={styles.settingRow}>
        <Text style={styles.label}>Report Name</Text>
        <TextInput
          style={styles.input}
          value={reportName}
          onChangeText={setReportName}
          placeholder="Enter report name"
          placeholderTextColor="#999"
        />
      </View>

      <View style={styles.settingRow}>
        <Text style={styles.label}>Format</Text>
        <View style={styles.badgeContainer}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{selectedFormat.toUpperCase()}</Text>
          </View>
        </View>
      </View>

      {selectedFormat === 'pdf' && (
        <>
          <View style={styles.settingRow}>
            <Text style={styles.label}>Include Charts</Text>
            <Switch value={includeCharts} onValueChange={setIncludeCharts} />
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.label}>Orientation</Text>
            <View style={styles.toggleGroup}>
              {(['portrait', 'landscape'] as const).map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.toggleButton,
                    orientation === opt && styles.toggleButtonActive,
                  ]}
                  onPress={() => setOrientation(opt)}
                >
                  <Text style={[
                    styles.toggleText,
                    orientation === opt && styles.toggleTextActive,
                  ]}>
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </>
      )}

      <View style={styles.settingRow}>
        <Text style={styles.label}>Compression</Text>
        <View style={styles.compressionOptions}>
          {compressions.map(comp => (
            <TouchableOpacity
              key={comp.id}
              style={[
                styles.compressionButton,
                compression === comp.id && styles.compressionButtonActive,
              ]}
              onPress={() => setCompression(comp.id as any)}
            >
              <Text style={[
                styles.compressionText,
                compression === comp.id && styles.compressionTextActive,
              ]}>
                {comp.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Card>
  );

  const renderScheduleSettings = () => (
    <Card style={styles.section}>
      <View style={styles.settingRow}>
        <Text style={styles.label}>Schedule Report</Text>
        <Switch value={isScheduled} onValueChange={setIsScheduled} />
      </View>

      {isScheduled && (
        <View>
          <Text style={styles.subLabel}>Frequency</Text>
          <View style={styles.frequencyButtons}>
            {frequencies.map(freq => (
              <TouchableOpacity
                key={freq.id}
                style={[
                  styles.freqButton,
                  scheduleFrequency === freq.id && styles.freqButtonActive,
                ]}
                onPress={() => setScheduleFrequency(freq.id as any)}
              >
                <Text style={[
                  styles.freqText,
                  scheduleFrequency === freq.id && styles.freqTextActive,
                ]}>
                  {freq.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </Card>
  );

  const renderEmailSettings = () => (
    <Card style={styles.section}>
      <View style={styles.settingRow}>
        <Text style={styles.label}>Email Delivery</Text>
        <Switch value={emailDelivery} onValueChange={setEmailDelivery} />
      </View>

      {emailDelivery && (
        <View style={styles.settingRow}>
          <Text style={styles.label}>Recipients</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={emailRecipients}
            onChangeText={setEmailRecipients}
            placeholder="Enter email addresses (comma-separated)"
            placeholderTextColor="#999"
            multiline
            numberOfLines={3}
          />
        </View>
      )}
    </Card>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Generate Report</Text>
          <TouchableOpacity onPress={onCancel}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          {renderBasicSettings()}
          {renderScheduleSettings()}
          {renderEmailSettings()}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label="Cancel"
            onPress={onCancel}
            style={[styles.footerButton, styles.cancelButton]}
          />
          {isScheduled ? (
            <Button
              label="Schedule"
              onPress={() => onSchedule({
                name: reportName,
                format: selectedFormat,
                frequency: scheduleFrequency,
                emailRecipients: emailRecipients.split(',').map(e => e.trim()),
                includeCharts,
                orientation,
                compression,
              })}
              style={styles.footerButton}
            />
          ) : (
            <Button
              label="Generate Now"
              onPress={() => onGenerate({
                name: reportName,
                format: selectedFormat,
                emailRecipients: emailDelivery ? emailRecipients.split(',').map(e => e.trim()) : [],
                includeCharts,
                orientation,
                compression,
              })}
              style={styles.footerButton}
            />
          )}
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
  settingRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    paddingHorizontal: 12,
    marginVertical: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#212121',
    flex: 1,
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  badgeContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  badge: {
    backgroundColor: '#E3F2FD',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1976d2',
  },
  toggleGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
  },
  toggleButtonActive: {
    backgroundColor: '#1976d2',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  toggleTextActive: {
    color: '#fff',
  },
  compressionOptions: {
    gap: 6,
  },
  compressionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  compressionButtonActive: {
    backgroundColor: '#E3F2FD',
    borderColor: '#1976d2',
  },
  compressionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  compressionTextActive: {
    color: '#1976d2',
  },
  frequencyButtons: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
  },
  freqButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    alignItems: 'center',
  },
  freqButtonActive: {
    backgroundColor: '#1976d2',
  },
  freqText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  freqTextActive: {
    color: '#fff',
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
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
});
