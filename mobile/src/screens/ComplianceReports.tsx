/**
 * Compliance Reports - Generate and manage compliance reports
 */

import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, FlatList, Text, Alert, ActivityIndicator } from 'react-native';
import { ScreenContainer, Header, Card, CardBody, Badge, Spacer, Button, TextInput, Select } from '@/components';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  interval: string;
  icon: string;
}

interface GeneratedReport {
  id: string;
  name: string;
  date: string;
  period: string;
  format: string;
  status: 'completed' | 'pending' | 'failed';
  size: string;
}

export const ComplianceReportsScreen = ({ navigation }: any) => {
  const [selectedTemplate, setSelectedTemplate] = useState('quarterly');
  const [selectedFormat, setSelectedFormat] = useState('pdf');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const [templates] = useState<ReportTemplate[]>([
    {
      id: 'quarterly',
      name: 'Quarterly Report',
      description: 'All covenants for past 3 months',
      interval: 'Q1, Q2, Q3, Q4',
      icon: '📊',
    },
    {
      id: 'annual',
      name: 'Annual Report',
      description: 'Full year compliance overview',
      interval: 'Yearly',
      icon: '📈',
    },
    {
      id: 'breach',
      name: 'Breach Report',
      description: 'List of breaches and actions',
      interval: 'On-demand',
      icon: '⚠️',
    },
    {
      id: 'summary',
      name: 'Compliance Summary',
      description: 'Quick summary of all covenants',
      interval: 'On-demand',
      icon: '📋',
    },
  ]);

  const [generatedReports] = useState<GeneratedReport[]>([
    {
      id: '1',
      name: 'Q3 2026 Quarterly Report',
      date: '2026-09-30',
      period: 'Jul 1 - Sep 30, 2026',
      format: 'PDF',
      status: 'completed',
      size: '3.2 MB',
    },
    {
      id: '2',
      name: 'Q2 2026 Quarterly Report',
      date: '2026-06-30',
      period: 'Apr 1 - Jun 30, 2026',
      format: 'PDF',
      status: 'completed',
      size: '2.9 MB',
    },
    {
      id: '3',
      name: 'Breach Summary - September',
      date: '2026-09-25',
      period: 'Sep 1 - Sep 25, 2026',
      format: 'PDF',
      status: 'completed',
      size: '1.5 MB',
    },
  ]);

  const formats = [
    { label: 'PDF Document', value: 'pdf' },
    { label: 'Excel Spreadsheet', value: 'excel' },
    { label: 'CSV Data', value: 'csv' },
  ];

  const handleGenerateReport = async () => {
    if (!startDate || !endDate) {
      Alert.alert('Error', 'Please select both start and end dates');
      return;
    }

    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      Alert.alert('Success', 'Report generated successfully');
    }, 2000);
  };

  const handleDownload = (report: GeneratedReport) => {
    Alert.alert('Download', `Downloading ${report.name}...`);
  };

  const handleEmail = () => {
    Alert.alert('Email', 'Email feature coming soon');
  };

  const handleSign = () => {
    Alert.alert('Sign', 'Electronically sign this report');
  };

  return (
    <ScreenContainer>
      <Header title="Compliance Reports" onBack={() => navigation.goBack()} />
      <Spacer size="small" />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Generate New Report */}
        <Text style={styles.sectionTitle}>Generate New Report</Text>

        {/* Template Selection */}
        <Text style={styles.subsectionTitle}>Select Template</Text>
        <FlatList
          data={templates}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <Card
              onPress={() => setSelectedTemplate(item.id)}
              style={[
                styles.templateCard,
                selectedTemplate === item.id && styles.selectedTemplate,
              ]}
            >
              <CardBody>
                <View style={styles.templateContent}>
                  <Text style={styles.templateIcon}>{item.icon}</Text>
                  <View style={styles.templateText}>
                    <Text style={styles.templateName}>{item.name}</Text>
                    <Text style={styles.templateDesc}>{item.description}</Text>
                    <Text style={styles.templateInterval}>{item.interval}</Text>
                  </View>
                </View>
              </CardBody>
            </Card>
          )}
          columnWrapperStyle={styles.templateGrid}
          numColumns={2}
        />

        <Spacer size="medium" />

        {/* Date Range Selection */}
        <Text style={styles.subsectionTitle}>Date Range</Text>
        <View style={styles.dateContainer}>
          <TextInput
            placeholder="Start Date (YYYY-MM-DD)"
            value={startDate}
            onChangeText={setStartDate}
            containerStyle={styles.dateInput}
          />
          <TextInput
            placeholder="End Date (YYYY-MM-DD)"
            value={endDate}
            onChangeText={setEndDate}
            containerStyle={styles.dateInput}
          />
        </View>

        <Spacer size="medium" />

        {/* Format Selection */}
        <Text style={styles.subsectionTitle}>Export Format</Text>
        <View style={styles.formatButtons}>
          {formats.map(format => (
            <Card
              key={format.value}
              onPress={() => setSelectedFormat(format.value)}
              style={[
                styles.formatCard,
                selectedFormat === format.value && styles.selectedFormat,
              ]}
            >
              <CardBody style={styles.formatBody}>
                <Text style={styles.formatLabel}>{format.label}</Text>
              </CardBody>
            </Card>
          ))}
        </View>

        <Spacer size="large" />

        {/* Generate Button */}
        <Button
          title={isGenerating ? 'Generating...' : 'Generate Report'}
          onPress={handleGenerateReport}
          disabled={isGenerating}
          size="large"
        />

        <Spacer size="large" />

        {/* Generated Reports */}
        <Text style={styles.sectionTitle}>
          Recent Reports ({generatedReports.length})
        </Text>

        {generatedReports.length === 0 ? (
          <Card>
            <CardBody>
              <Text style={styles.emptyText}>No reports generated yet</Text>
            </CardBody>
          </Card>
        ) : (
          <FlatList
            data={generatedReports}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <Card style={styles.reportCard}>
                <CardBody>
                  <View style={styles.reportHeader}>
                    <View style={styles.reportInfo}>
                      <Text style={styles.reportName}>{item.name}</Text>
                      <Text style={styles.reportPeriod}>{item.period}</Text>
                      <View style={styles.reportMeta}>
                        <Badge label={item.format} variant="secondary" />
                        <Text style={styles.reportDate}>{item.date}</Text>
                        <Text style={styles.reportSize}>{item.size}</Text>
                      </View>
                    </View>
                    <Badge
                      label={item.status === 'completed' ? '✓' : '...'}
                      variant={
                        item.status === 'completed'
                          ? 'success'
                          : item.status === 'failed'
                          ? 'danger'
                          : 'warning'
                      }
                    />
                  </View>

                  {/* Report Actions */}
                  <View style={styles.reportActions}>
                    <Button
                      title="Download"
                      onPress={() => handleDownload(item)}
                      variant="secondary"
                      size="small"
                      style={styles.actionBtn}
                    />
                    <Button
                      title="Email"
                      onPress={handleEmail}
                      variant="secondary"
                      size="small"
                      style={styles.actionBtn}
                    />
                    <Button
                      title="Sign"
                      onPress={handleSign}
                      variant="secondary"
                      size="small"
                      style={styles.actionBtn}
                    />
                  </View>
                </CardBody>
              </Card>
            )}
          />
        )}

        <Spacer size="large" />

        {/* Report Contents Preview */}
        <Text style={styles.sectionTitle}>Report Contents</Text>
        <Card>
          <CardBody>
            <View style={styles.contentsList}>
              <Text style={styles.contentItem}>✓ Covenant Summary</Text>
              <Text style={styles.contentItem}>✓ Compliance Scores</Text>
              <Text style={styles.contentItem}>✓ Breach History</Text>
              <Text style={styles.contentItem}>✓ Corrective Actions</Text>
              <Text style={styles.contentItem}>✓ Trend Analysis</Text>
              <Text style={styles.contentItem}>✓ Forecast (if applicable)</Text>
            </View>
          </CardBody>
        </Card>

        <Spacer size="large" />
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  subsectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  templateGrid: {
    paddingHorizontal: 8,
    gap: 8,
    justifyContent: 'space-between',
  },
  templateCard: {
    flex: 1,
    margin: 4,
  },
  selectedTemplate: {
    borderWidth: 2,
    borderColor: '#2196F3',
    backgroundColor: '#e3f2fd',
  },
  templateContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  templateIcon: {
    fontSize: 24,
  },
  templateText: {
    flex: 1,
  },
  templateName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  templateDesc: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  templateInterval: {
    fontSize: 9,
    color: '#ccc',
    marginTop: 2,
  },
  dateContainer: {
    gap: 8,
    paddingHorizontal: 12,
  },
  dateInput: {
    flex: 1,
  },
  formatButtons: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    gap: 8,
  },
  formatCard: {
    flex: 1,
  },
  selectedFormat: {
    backgroundColor: '#e3f2fd',
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  formatBody: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  formatLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  reportCard: {
    marginHorizontal: 12,
    marginVertical: 4,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reportInfo: {
    flex: 1,
  },
  reportName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  reportPeriod: {
    fontSize: 11,
    color: '#999',
    marginBottom: 6,
  },
  reportMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reportDate: {
    fontSize: 10,
    color: '#999',
  },
  reportSize: {
    fontSize: 10,
    color: '#999',
  },
  reportActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    flex: 1,
    minWidth: '30%',
  },
  emptyText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },
  contentsList: {
    gap: 6,
  },
  contentItem: {
    fontSize: 12,
    color: '#333',
    lineHeight: 20,
  },
});
