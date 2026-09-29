/**
 * Import Screen
 * Upload and configure data import
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';

interface ImportScreenProps {
  onImport?: (config: any) => void;
}

export const ImportScreen: React.FC<ImportScreenProps> = ({ onImport }) => {
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [featureType, setFeatureType] = useState('projects');
  const [conflictStrategy, setConflictStrategy] = useState('skip');
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [importHistory, setImportHistory] = useState<any[]>([
    { id: '1', name: 'Projects Import', feature: 'projects', date: '2 days ago', records: 15, status: 'success' },
    { id: '2', name: 'Inspections Import', feature: 'inspections', date: '1 week ago', records: 42, status: 'success' },
  ]);

  const handleFileSelect = useCallback(() => {
    // Simulating file selection
    const mockFile = {
      name: 'data.csv',
      size: 2048,
      type: 'text/csv',
      lastModified: Date.now(),
    };
    setSelectedFile(mockFile);
    setPreview([
      { id: 1, name: 'Project A', status: 'Active', budget: '10000' },
      { id: 2, name: 'Project B', status: 'Pending', budget: '25000' },
      { id: 3, name: 'Project C', status: 'Active', budget: '15000' },
      { id: 4, name: 'Project D', status: 'Completed', budget: '8000' },
      { id: 5, name: 'Project E', status: 'Active', budget: '32000' },
    ]);
  }, []);

  const handleImport = useCallback(() => {
    if (!selectedFile) {
      Alert.alert('Error', 'Please select a file to import');
      return;
    }

    setImporting(true);
    const config = {
      file: selectedFile,
      featureType,
      conflictStrategy,
      timestamp: new Date().toISOString(),
    };

    setTimeout(() => {
      setImporting(false);
      Alert.alert('Success', `Imported ${preview.length} records from ${selectedFile.name}`);
      onImport?.(config);
    }, 2000);
  }, [selectedFile, featureType, conflictStrategy, preview, onImport]);

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.csv')) return '📊';
    if (fileName.endsWith('.json')) return '{}';
    if (fileName.endsWith('.xlsx')) return '📑';
    return '📄';
  };

  const getStrategyDescription = () => {
    const descriptions: Record<string, string> = {
      skip: 'Skip duplicate records',
      merge: 'Merge with existing data (newer wins)',
      replace: 'Replace all existing data',
    };
    return descriptions[conflictStrategy] || '';
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Upload File</Text>

        <TouchableOpacity
          style={[
            styles.uploadArea,
            selectedFile && styles.uploadAreaActive,
          ]}
          onPress={handleFileSelect}
        >
          {selectedFile ? (
            <View style={styles.uploadSuccess}>
              <Text style={styles.uploadIcon}>{getFileIcon(selectedFile.name)}</Text>
              <Text style={styles.uploadFileName}>{selectedFile.name}</Text>
              <Text style={styles.uploadFileSize}>
                {(selectedFile.size / 1024).toFixed(1)} KB
              </Text>
            </View>
          ) : (
            <View style={styles.uploadPrompt}>
              <Text style={styles.uploadIcon}>📥</Text>
              <Text style={styles.uploadText}>Tap to select file</Text>
              <Text style={styles.uploadSubtext}>CSV, JSON, or Excel</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.supportedFormats}>
          Supported formats: CSV, JSON, Excel (max 100MB)
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Feature Type</Text>

        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={featureType}
            onValueChange={setFeatureType}
            style={styles.picker}
          >
            <Picker.Item label="Projects" value="projects" />
            <Picker.Item label="Inspections" value="inspections" />
            <Picker.Item label="Work Orders" value="workorders" />
            <Picker.Item label="Compliance Records" value="compliance" />
            <Picker.Item label="Reports" value="reports" />
          </Picker>
        </View>
      </View>

      {selectedFile && (
        <>
          <View style={styles.section}>
            <View style={styles.previewButton}>
              <TouchableOpacity
                style={styles.previewToggle}
                onPress={() => setShowPreview(!showPreview)}
              >
                <Text style={styles.previewToggleText}>
                  {showPreview ? '▼' : '▶'} Preview (First 5 Records)
                </Text>
              </TouchableOpacity>
            </View>

            {showPreview && (
              <View style={styles.previewContainer}>
                <View style={styles.previewTable}>
                  <View style={styles.previewRow}>
                    {Object.keys(preview[0] || {}).map((key, i) => (
                      <Text key={i} style={styles.previewHeader}>
                        {key}
                      </Text>
                    ))}
                  </View>

                  {preview.map((row, rowIndex) => (
                    <View key={rowIndex} style={styles.previewRow}>
                      {Object.values(row).map((val, colIndex) => (
                        <Text key={colIndex} style={styles.previewCell}>
                          {String(val)}
                        </Text>
                      ))}
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Conflict Resolution</Text>

            {['skip', 'merge', 'replace'].map(strategy => (
              <TouchableOpacity
                key={strategy}
                style={[
                  styles.strategyOption,
                  conflictStrategy === strategy && styles.strategyOptionActive,
                ]}
                onPress={() => setConflictStrategy(strategy)}
              >
                <View style={styles.strategyRadio}>
                  {conflictStrategy === strategy && <View style={styles.strategyRadioDot} />}
                </View>
                <View style={styles.strategyContent}>
                  <Text style={styles.strategyLabel}>
                    {strategy.charAt(0).toUpperCase() + strategy.slice(1)}
                  </Text>
                  <Text style={styles.strategyDescription}>
                    {
                      {
                        skip: 'Ignore duplicate records',
                        merge: 'Combine with existing data',
                        replace: 'Overwrite all existing records',
                      }[strategy]
                    }
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.section}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Import Summary</Text>
              <Text style={styles.summaryText}>
                File: {selectedFile.name}
              </Text>
              <Text style={styles.summaryText}>
                Feature: {featureType}
              </Text>
              <Text style={styles.summaryText}>
                Records: {preview.length}
              </Text>
              <Text style={styles.summaryText}>
                Strategy: {getStrategyDescription()}
              </Text>
            </View>
          </View>
        </>
      )}

      <TouchableOpacity
        style={[styles.importButton, (importing || !selectedFile) && styles.disabledButton]}
        onPress={handleImport}
        disabled={importing || !selectedFile}
      >
        <Text style={styles.importButtonText}>
          {importing ? 'Importing...' : 'Import Data'}
        </Text>
      </TouchableOpacity>

      {importHistory.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Import History</Text>

          {importHistory.map(imp => (
            <View key={imp.id} style={styles.historyItem}>
              <View style={styles.historyInfo}>
                <Text style={styles.historyName}>{imp.name}</Text>
                <Text style={styles.historyMeta}>
                  {imp.feature} • {imp.records} records • {imp.date}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  imp.status === 'success' && styles.statusSuccess,
                ]}
              >
                <Text style={styles.statusText}>
                  {imp.status === 'success' ? '✓' : '!'}
                </Text>
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
  uploadArea: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
  },
  uploadAreaActive: {
    borderColor: '#388e3c',
    backgroundColor: '#F1F8E9',
  },
  uploadPrompt: {
    alignItems: 'center',
  },
  uploadSuccess: {
    alignItems: 'center',
  },
  uploadIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  uploadText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  uploadSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  uploadFileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#388e3c',
    marginTop: 4,
  },
  uploadFileSize: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  supportedFormats: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  previewButton: {
    marginBottom: 12,
  },
  previewToggle: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
  },
  previewToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976d2',
  },
  previewContainer: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  previewTable: {
    backgroundColor: '#f5f5f5',
  },
  previewRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  previewHeader: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 11,
    fontWeight: '700',
    color: '#212121',
    backgroundColor: '#e0e0e0',
  },
  previewCell: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 11,
    color: '#666',
  },
  strategyOption: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 8,
  },
  strategyOptionActive: {
    borderColor: '#1976d2',
    backgroundColor: '#E3F2FD',
  },
  strategyRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  strategyRadioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1976d2',
  },
  strategyContent: {
    flex: 1,
  },
  strategyLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  strategyDescription: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
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
  importButton: {
    backgroundColor: '#1976d2',
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 20,
  },
  disabledButton: {
    opacity: 0.6,
  },
  importButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  historyInfo: {
    flex: 1,
  },
  historyName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  historyMeta: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  statusBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#d32f2f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusSuccess: {
    backgroundColor: '#388e3c',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
