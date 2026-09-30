/**
 * Reports Export - Generate and export reports in various formats
 */

import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, FlatList, Text, Alert, ActivityIndicator } from 'react-native';
import { ScreenContainer, Header, Card, CardBody, Badge, Spacer, Button, TextInput, Select } from '@/components';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface ExportFormat {
  id: string;
  label: string;
  ext: string;
}

interface GeneratedReport {
  id: string;
  name: string;
  format: string;
  date: string;
  size: string;
  status: 'pending' | 'completed' | 'failed';
}

export const ReportsExportScreen = ({ navigation }: any) => {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('comprehensive');
  const [selectedFormat, setSelectedFormat] = useState<string>('pdf');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([
    {
      id: '1',
      name: 'June 2026 Comprehensive Report',
      format: 'PDF',
      date: '2026-06-30',
      size: '2.4 MB',
      status: 'completed',
    },
    {
      id: '2',
      name: 'May 2026 Summary Report',
      format: 'CSV',
      date: '2026-05-31',
      size: '485 KB',
      status: 'completed',
    },
  ]);

  const templates: ReportTemplate[] = [
    { id: 'comprehensive', name: 'Comprehensive Report', description: 'All metrics & charts', icon: '📊' },
    { id: 'summary', name: 'Summary Report', description: 'Key KPIs only', icon: '📋' },
    { id: 'production', name: 'Production Report', description: 'Production & efficiency', icon: '⚡' },
    { id: 'financial', name: 'Financial Report', description: 'Costs & budget', icon: '💰' },
  ];

  const formats: ExportFormat[] = [
    { id: 'pdf', label: 'PDF Document', ext: '.pdf' },
    { id: 'csv', label: 'CSV Data', ext: '.csv' },
    { id: 'excel', label: 'Excel Spreadsheet', ext: '.xlsx' },
    { id: 'json', label: 'JSON Data', ext: '.json' },
  ];

  const handleGenerateReport = async () => {
    if (!startDate || !endDate) {
      Alert.alert('Error', 'Please select both start and end dates');
      return;
    }

    setIsGenerating(true);
    setTimeout(() => {
      const newReport: GeneratedReport = {
        id: Date.now().toString(),
        name: `${templates.find(t => t.id === selectedTemplate)?.name} (${startDate} to ${endDate})`,
        format: selectedFormat.toUpperCase(),
        date: new Date().toISOString().split('T')[0],
        size: `${(Math.random() * 3 + 0.5).toFixed(1)} MB`,
        status: 'completed',
      };
      setGeneratedReports([newReport, ...generatedReports]);
      setIsGenerating(false);
      Alert.alert('Success', 'Report generated successfully');
    }, 2000);
  };

  const handleDownload = (report: GeneratedReport) => {
    Alert.alert('Download', `Downloading ${report.name}`);
  };

  const handleEmail = () => {
    Alert.alert('Email', 'Share report via email feature coming soon');
  };

  return (
    <ScreenContainer>
      <Header title="Reports & Export" onBack={() => navigation.goBack()} />
      <Spacer size="small" />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Report Generation Section */}
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
                selectedTemplate === item.id && styles.selectedCard,
              ]}
            >
              <CardBody>
                <View style={styles.templateContent}>
                  <Text style={styles.templateIcon}>{item.icon}</Text>
                  <View style={styles.templateText}>
                    <Text style={styles.templateName}>{item.name}</Text>
                    <Text style={styles.templateDesc}>{item.description}</Text>
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

        {/* Export Format Selection */}
        <Text style={styles.subsectionTitle}>Export Format</Text>
        <View style={styles.formatContainer}>
          {formats.map((format) => (
            <Card
              key={format.id}
              onPress={() => setSelectedFormat(format.id)}
              style={[
                styles.formatCard,
                selectedFormat === format.id && styles.selectedFormatCard,
              ]}
            >
              <CardBody style={styles.formatContent}>
                <Text style={styles.formatLabel}>{format.label}</Text>
                <Text style={styles.formatExt}>{format.ext}</Text>
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
                  <View style={styles.reportActions}>
                    <Button
                      title="Download"
                      onPress={() => handleDownload(item)}
                      variant="secondary"
                      size="small"
                      style={styles.actionButton}
                    />
                    <Button
                      title="Email"
                      onPress={handleEmail}
                      variant="secondary"
                      size="small"
                      style={styles.actionButton}
                    />
                  </View>
                </CardBody>
              </Card>
            )}
          />
        )}

        <Spacer size="large" />

        {/* Export Tips */}
        <Text style={styles.sectionTitle}>Tips</Text>
        <Card>
          <CardBody>
            <View style={styles.tipsList}>
              <Text style={styles.tipItem}>
                📌 PDF format includes charts and visualizations
              </Text>
              <Text style={styles.tipItem}>
                📌 CSV/Excel formats are ideal for further analysis
              </Text>
              <Text style={styles.tipItem}>
                📌 Reports are stored in your device for 30 days
              </Text>
              <Text style={styles.tipItem}>
                📌 Large reports may take a few moments to generate
              </Text>
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
  selectedCard: {
    borderWidth: 2,
    borderColor: '#1976d2',
  },
  templateContent: {
    flexDirection: 'row',
    alignItems: 'center',
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
  dateContainer: {
    gap: 8,
    paddingHorizontal: 12,
  },
  dateInput: {
    flex: 1,
  },
  formatContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    gap: 8,
  },
  formatCard: {
    flex: 1,
    minWidth: '45%',
  },
  selectedFormatCard: {
    backgroundColor: '#e3f2fd',
    borderWidth: 2,
    borderColor: '#1976d2',
  },
  formatContent: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  formatLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  formatExt: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
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
    gap: 8,
  },
  actionButton: {
    flex: 1,
  },
  emptyText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },
  tipsList: {
    gap: 8,
  },
  tipItem: {
    fontSize: 12,
    color: '#333',
    lineHeight: 18,
  },
});
