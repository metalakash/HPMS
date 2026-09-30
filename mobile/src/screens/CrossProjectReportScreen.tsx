/**
 * Cross-Project Report Screen
 * Generate and view cross-project reports
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';

interface Report {
  id: string;
  name: string;
  type: 'activity' | 'compliance' | 'performance' | 'team';
  generated: string;
  projectCount: number;
  format: string;
  size: string;
}

export const CrossProjectReportScreen: React.FC = () => {
  const [reportType, setReportType] = useState<'activity' | 'compliance' | 'performance' | 'team'>(
    'activity'
  );
  const [selectedProjects, setSelectedProjects] = useState<string[]>(['all']);
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState(new Date());
  const [groupBy, setGroupBy] = useState<'project' | 'user' | 'feature'>('project');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'value'>('name');
  const [format, setFormat] = useState<'csv' | 'pdf' | 'json'>('pdf');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [generatedReports, setGeneratedReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  const projectOptions = [
    { id: 'all', name: 'All Projects' },
    { id: 'proj-1', name: 'Hydropower Alpha' },
    { id: 'proj-2', name: 'Hydropower Beta' },
    { id: 'proj-3', name: 'Pumped Storage' },
    { id: 'proj-4', name: 'Tidal Energy' },
  ];

  const toggleProjectSelection = (projectId: string) => {
    if (projectId === 'all') {
      setSelectedProjects(prev => (prev.includes('all') ? [] : ['all']));
    } else {
      setSelectedProjects(prev => {
        const withoutAll = prev.filter(p => p !== 'all');
        const updated = prev.includes(projectId)
          ? withoutAll.filter(p => p !== projectId)
          : [...withoutAll, projectId];
        return updated.length === 0 ? ['all'] : updated;
      });
    }
  };

  const generateReport = useCallback(async () => {
    if (selectedProjects.length === 0) {
      Alert.alert('Error', 'Please select at least one project');
      return;
    }

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      const newReport: Report = {
        id: `report-${Date.now()}`,
        name: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`,
        type: reportType,
        generated: new Date().toLocaleString(),
        projectCount: selectedProjects.includes('all') ? 4 : selectedProjects.length,
        format,
        size: `${Math.floor(Math.random() * 50) + 10}KB`,
      };

      setGeneratedReports(prev => [newReport, ...prev]);
      setSelectedReport(newReport);
      Alert.alert('Success', 'Report generated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  }, [reportType, selectedProjects, format]);

  const downloadReport = useCallback((report: Report) => {
    Alert.alert('Success', `Downloaded ${report.name}.${report.format}`);
  }, []);

  const deleteReport = useCallback((reportId: string) => {
    setGeneratedReports(prev => prev.filter(r => r.id !== reportId));
    if (selectedReport?.id === reportId) {
      setSelectedReport(null);
    }
  }, [selectedReport]);

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString();
  };

  const renderReportRow = ({ item }: { item: Report }) => (
    <View
      style={[
        styles.reportRow,
        selectedReport?.id === item.id && styles.reportRowSelected,
      ]}
      testID={`report-row-${item.id}`}
    >
      <TouchableOpacity
        style={styles.reportContent}
        onPress={() => setSelectedReport(item)}
      >
        <Text style={styles.reportName}>{item.name}</Text>
        <View style={styles.reportMeta}>
          <Text style={styles.reportMetaText}>
            {item.projectCount} project{item.projectCount !== 1 ? 's' : ''}
          </Text>
          <Text style={styles.reportMetaText}>•</Text>
          <Text style={styles.reportMetaText}>{item.format.toUpperCase()}</Text>
          <Text style={styles.reportMetaText}>•</Text>
          <Text style={styles.reportMetaText}>{item.size}</Text>
        </View>
        <Text style={styles.reportGenerated}>{item.generated}</Text>
      </TouchableOpacity>

      <View style={styles.reportActions}>
        <TouchableOpacity
          style={styles.reportActionButton}
          onPress={() => downloadReport(item)}
          testID={`download-report-${item.id}`}
        >
          <Text style={styles.reportActionText}>⬇</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.reportActionButton}
          onPress={() => deleteReport(item.id)}
          testID={`delete-report-${item.id}`}
        >
          <Text style={styles.reportActionText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container} testID="cross-project-report-screen">
      <ScrollView style={styles.content}>
        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={styles.screenTitle}>Generate Report</Text>
        </View>

        {/* Report Type */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Report Type</Text>
          <View style={styles.reportTypeButtons}>
            {[
              { id: 'activity', label: 'Activity' },
              { id: 'compliance', label: 'Compliance' },
              { id: 'performance', label: 'Performance' },
              { id: 'team', label: 'Team' },
            ].map(type => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.typeButton,
                  reportType === type.id && styles.typeButtonActive,
                ]}
                onPress={() => setReportType(type.id as any)}
                testID={`report-type-${type.id}`}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    reportType === type.id && styles.typeButtonTextActive,
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Project Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Projects</Text>
          <View style={styles.projectCheckboxes}>
            {projectOptions.map(project => (
              <TouchableOpacity
                key={project.id}
                style={styles.checkboxRow}
                onPress={() => toggleProjectSelection(project.id)}
                testID={`select-report-project-${project.id}`}
              >
                <View
                  style={[
                    styles.checkbox,
                    selectedProjects.includes(project.id) && styles.checkboxChecked,
                  ]}
                >
                  {selectedProjects.includes(project.id) && (
                    <Text style={styles.checkboxMark}>✓</Text>
                  )}
                </View>
                <Text style={styles.checkboxLabel}>{project.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Date Range */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Date Range</Text>
          <View style={styles.dateRow}>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowStartDatePicker(true)}
              testID="report-date-start"
            >
              <Text style={styles.dateButtonText}>{formatDate(startDate)}</Text>
            </TouchableOpacity>
            <Text style={styles.dateRangeSeparator}>to</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowEndDatePicker(true)}
              testID="report-date-end"
            >
              <Text style={styles.dateButtonText}>{formatDate(endDate)}</Text>
            </TouchableOpacity>
          </View>

          {showStartDatePicker && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display="default"
              onChange={(event, date) => {
                if (date) setStartDate(date);
                setShowStartDatePicker(false);
              }}
            />
          )}

          {showEndDatePicker && (
            <DateTimePicker
              value={endDate}
              mode="date"
              display="default"
              onChange={(event, date) => {
                if (date) setEndDate(date);
                setShowEndDatePicker(false);
              }}
            />
          )}
        </View>

        {/* Grouping & Sorting */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Grouping</Text>
          <Picker
            selectedValue={groupBy}
            style={styles.picker}
            onValueChange={setGroupBy}
            testID="report-groupby"
          >
            <Picker.Item label="By Project" value="project" />
            <Picker.Item label="By User" value="user" />
            <Picker.Item label="By Feature" value="feature" />
          </Picker>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Sort By</Text>
          <Picker
            selectedValue={sortBy}
            style={styles.picker}
            onValueChange={setSortBy}
            testID="report-sortby"
          >
            <Picker.Item label="Name" value="name" />
            <Picker.Item label="Date" value="date" />
            <Picker.Item label="Value" value="value" />
          </Picker>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Export Format</Text>
          <View style={styles.formatButtons}>
            {(['csv', 'pdf', 'json'] as const).map(fmt => (
              <TouchableOpacity
                key={fmt}
                style={[
                  styles.formatButton,
                  format === fmt && styles.formatButtonActive,
                ]}
                onPress={() => setFormat(fmt)}
                testID={`report-format-${fmt}`}
              >
                <Text
                  style={[
                    styles.formatButtonText,
                    format === fmt && styles.formatButtonTextActive,
                  ]}
                >
                  {fmt.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Generate Button */}
        <TouchableOpacity
          style={[styles.generateButton, loading && styles.generateButtonDisabled]}
          onPress={generateReport}
          disabled={loading}
          testID="generate-report-button"
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.generateButtonText}>Generate Report</Text>
          )}
        </TouchableOpacity>

        {/* Generated Reports */}
        {generatedReports.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Generated Reports</Text>
            <FlatList
              data={generatedReports}
              renderItem={renderReportRow}
              keyExtractor={item => item.id}
              scrollEnabled={false}
              testID="generated-reports-list"
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 12,
  },
  headerSection: {
    marginBottom: 20,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  reportTypeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  typeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  projectCheckboxes: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  checkboxMark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 13,
    color: '#333',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateButton: {
    flex: 1,
    height: 40,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  dateButtonText: {
    fontSize: 13,
    color: '#333',
  },
  dateRangeSeparator: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
  },
  picker: {
    height: 40,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  formatButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  formatButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  formatButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  formatButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  formatButtonTextActive: {
    color: '#fff',
  },
  generateButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  reportRowSelected: {
    backgroundColor: '#f0f7ff',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  reportContent: {
    flex: 1,
  },
  reportName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  reportMeta: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  reportMetaText: {
    fontSize: 11,
    color: '#666',
  },
  reportGenerated: {
    fontSize: 10,
    color: '#999',
  },
  reportActions: {
    flexDirection: 'row',
    gap: 8,
  },
  reportActionButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    backgroundColor: '#f5f5f5',
  },
  reportActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
