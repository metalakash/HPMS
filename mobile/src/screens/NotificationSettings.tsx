/**
 * Notification Settings Screen
 * Manage notification preferences, alert sounds, vibration, and DND schedule
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotificationPreferences } from '../hooks/useNotifications';
import { Card } from '../components/Card';
import { Button } from '../components/Button';

export const NotificationSettings = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { preferences, updatePreferences, loading } = useNotificationPreferences();

  const [enabled, setEnabled] = useState(preferences?.enabled ?? true);
  const [inspections, setInspections] = useState(preferences?.inspections ?? 'all');
  const [maintenance, setMaintenance] = useState(preferences?.maintenance ?? 'all');
  const [documents, setDocuments] = useState(preferences?.documents ?? 'all');
  const [analytics, setAnalytics] = useState(preferences?.analytics ?? 'all');
  const [covenants, setCovenants] = useState(preferences?.covenants ?? 'all');
  const [sound, setSound] = useState(preferences?.sound ?? true);
  const [vibration, setVibration] = useState(preferences?.vibration ?? true);
  const [dndEnabled, setDndEnabled] = useState(
    !!(preferences?.dndStart && preferences?.dndEnd)
  );
  const [dndStart, setDndStart] = useState(preferences?.dndStart ?? '22:00');
  const [dndEnd, setDndEnd] = useState(preferences?.dndEnd ?? '08:00');
  const [showBadge, setShowBadge] = useState(preferences?.showBadge ?? true);

  const [isDirty, setIsDirty] = useState(false);

  const featureOptions = [
    { value: 'all', label: 'All notifications' },
    { value: 'important', label: 'Important only' },
    { value: 'none', label: 'None' },
  ];

  const handleSave = async () => {
    try {
      await updatePreferences({
        enabled,
        inspections: inspections as any,
        maintenance: maintenance as any,
        documents: documents as any,
        analytics: analytics as any,
        covenants: covenants as any,
        sound,
        vibration,
        dndStart: dndEnabled ? dndStart : undefined,
        dndEnd: dndEnabled ? dndEnd : undefined,
        showBadge,
      });

      setIsDirty(false);
      Alert.alert('Success', 'Notification settings saved');
    } catch (error) {
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const handleToggleFeature = (
    feature: string,
    value: string
  ) => {
    switch (feature) {
      case 'inspections':
        setInspections(value);
        break;
      case 'maintenance':
        setMaintenance(value);
        break;
      case 'documents':
        setDocuments(value);
        break;
      case 'analytics':
        setAnalytics(value);
        break;
      case 'covenants':
        setCovenants(value);
        break;
    }
    setIsDirty(true);
  };

  const renderFeatureSettings = (
    feature: string,
    label: string,
    icon: string,
    value: string
  ) => (
    <Card key={feature} style={styles.featureCard}>
      <View style={styles.featureHeader}>
        <Text style={styles.featureIcon}>{icon}</Text>
        <Text style={styles.featureLabel}>{label}</Text>
      </View>
      <View style={styles.optionButtons}>
        {featureOptions.map(option => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionButton,
              value === option.value && styles.optionButtonActive,
            ]}
            onPress={() => handleToggleFeature(feature, option.value)}
          >
            <Text
              style={[
                styles.optionButtonText,
                value === option.value && styles.optionButtonTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Card>
  );

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Notification Settings</Text>
      </View>

      {/* Global Settings */}
      <Card style={styles.section}>
        <View style={styles.settingRow}>
          <View style={styles.settingLabel}>
            <Text style={styles.settingTitle}>Notifications</Text>
            <Text style={styles.settingSubtitle}>Enable all notifications</Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={value => {
              setEnabled(value);
              setIsDirty(true);
            }}
            trackColor={{ false: '#ccc', true: '#1976d2' }}
          />
        </View>
      </Card>

      {/* Feature Preferences */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Features</Text>
        {renderFeatureSettings('inspections', 'Inspections', '📋', inspections)}
        {renderFeatureSettings('maintenance', 'Maintenance', '🔧', maintenance)}
        {renderFeatureSettings('documents', 'Documents', '📄', documents)}
        {renderFeatureSettings('analytics', 'Analytics', '📊', analytics)}
        {renderFeatureSettings('covenants', 'Covenants', '📑', covenants)}
      </View>

      {/* Sound & Vibration */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Alerts</Text>
        <Card>
          <View style={styles.settingRow}>
            <View style={styles.settingLabel}>
              <Text style={styles.settingTitle}>Sound</Text>
              <Text style={styles.settingSubtitle}>Play notification sound</Text>
            </View>
            <Switch
              value={sound}
              onValueChange={value => {
                setSound(value);
                setIsDirty(true);
              }}
              trackColor={{ false: '#ccc', true: '#1976d2' }}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLabel}>
              <Text style={styles.settingTitle}>Vibration</Text>
              <Text style={styles.settingSubtitle}>Vibrate on notification</Text>
            </View>
            <Switch
              value={vibration}
              onValueChange={value => {
                setVibration(value);
                setIsDirty(true);
              }}
              trackColor={{ false: '#ccc', true: '#1976d2' }}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLabel}>
              <Text style={styles.settingTitle}>Badge</Text>
              <Text style={styles.settingSubtitle}>Show unread count on app icon</Text>
            </View>
            <Switch
              value={showBadge}
              onValueChange={value => {
                setShowBadge(value);
                setIsDirty(true);
              }}
              trackColor={{ false: '#ccc', true: '#1976d2' }}
            />
          </View>
        </Card>
      </View>

      {/* Do Not Disturb */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Do Not Disturb</Text>
        <Card>
          <View style={styles.settingRow}>
            <View style={styles.settingLabel}>
              <Text style={styles.settingTitle}>Enable DND</Text>
              <Text style={styles.settingSubtitle}>Silence notifications during these hours</Text>
            </View>
            <Switch
              value={dndEnabled}
              onValueChange={value => {
                setDndEnabled(value);
                setIsDirty(true);
              }}
              trackColor={{ false: '#ccc', true: '#1976d2' }}
            />
          </View>

          {dndEnabled && (
            <>
              <View style={styles.divider} />
              <View style={styles.timeRow}>
                <View style={styles.timeInput}>
                  <Text style={styles.timeLabel}>From</Text>
                  <Text style={styles.timeValue}>{dndStart}</Text>
                </View>
                <Text style={styles.timeConnector}>to</Text>
                <View style={styles.timeInput}>
                  <Text style={styles.timeLabel}>To</Text>
                  <Text style={styles.timeValue}>{dndEnd}</Text>
                </View>
              </View>
            </>
          )}
        </Card>
      </View>

      {/* Save Button */}
      {isDirty && (
        <View style={styles.actionContainer}>
          <Button
            label="Save Settings"
            onPress={handleSave}
            style={styles.saveButton}
            loading={loading}
          />
        </View>
      )}

      {/* Test Notification */}
      <View style={styles.actionContainer}>
        <Card>
          <TouchableOpacity style={styles.testButton}>
            <Text style={styles.testButtonText}>Send Test Notification</Text>
          </TouchableOpacity>
        </Card>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212121',
  },
  sectionContainer: {
    marginHorizontal: 8,
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginHorizontal: 8,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  section: {
    marginHorizontal: 8,
    marginVertical: 12,
  },
  featureCard: {
    marginBottom: 8,
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  featureIcon: {
    fontSize: 20,
  },
  featureLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  optionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionButtonActive: {
    backgroundColor: '#1976d2',
    borderColor: '#1565c0',
  },
  optionButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  optionButtonTextActive: {
    color: '#fff',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingLabel: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 13,
    color: '#999',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingVertical: 8,
  },
  timeInput: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
  },
  timeConnector: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  actionContainer: {
    paddingHorizontal: 8,
    marginVertical: 12,
  },
  saveButton: {
    marginBottom: 0,
  },
  testButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    alignItems: 'center',
  },
  testButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976d2',
  },
  bottomPadding: {
    height: 32,
  },
});
