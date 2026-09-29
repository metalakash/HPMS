/**
 * Shared Dashboard Screen
 * Cross-project unified dashboard
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';

interface Project {
  id: string;
  name: string;
  status: string;
}

interface DashboardData {
  totalRecords: number;
  totalInspections: number;
  totalWorkOrders: number;
  totalCompliance: number;
}

export const SharedDashboardScreen: React.FC = () => {
  const [selectedProjects, setSelectedProjects] = useState<Project[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [projectHealth, setProjectHealth] = useState<any[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'mine' | 'shared'>('all');
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      // Simulate API call
      const mockProjects: Project[] = [
        { id: 'proj-1', name: 'Hydropower Alpha', status: 'active' },
        { id: 'proj-2', name: 'Hydropower Beta', status: 'active' },
        { id: 'proj-3', name: 'Pumped Storage', status: 'active' },
        { id: 'proj-4', name: 'Tidal Energy', status: 'active' },
      ];

      const mockData: DashboardData = {
        totalRecords: 485,
        totalInspections: 234,
        totalWorkOrders: 156,
        totalCompliance: 95,
      };

      const mockHealth = mockProjects.map((p, i) => ({
        projectId: p.id,
        name: p.name,
        health: Math.floor(Math.random() * 40) + 60,
        lastUpdated: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        status: ['Good', 'Fair', 'Needs Attention'][Math.floor(Math.random() * 3)],
      }));

      setAllProjects(mockProjects);
      setSelectedProjects(mockProjects);
      setDashboardData(mockData);
      setProjectHealth(mockHealth);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleProjectSelection = (project: Project) => {
    setSelectedProjects(prev =>
      prev.find(p => p.id === project.id)
        ? prev.filter(p => p.id !== project.id)
        : [...prev, project]
    );
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="shared-dashboard-screen">
      <ScrollView style={styles.content}>
        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={styles.screenTitle}>Cross-Project Dashboard</Text>
          <Text style={styles.subtitle}>
            Unified view across {selectedProjects.length} project{selectedProjects.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Date Range Section */}
        <View style={styles.dateRangeSection}>
          <Text style={styles.sectionLabel}>Date Range</Text>
          <View style={styles.dateRow}>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowStartDatePicker(true)}
              testID="date-start-picker"
            >
              <Text style={styles.dateButtonText}>{formatDate(startDate)}</Text>
            </TouchableOpacity>
            <Text style={styles.dateRangeSeparator}>to</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowEndDatePicker(true)}
              testID="date-end-picker"
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

        {/* Filter Mode Section */}
        <View style={styles.filterSection}>
          <Text style={styles.sectionLabel}>Project Filter</Text>
          <View style={styles.filterButtonRow}>
            <TouchableOpacity
              style={[styles.filterButton, filterMode === 'all' && styles.filterButtonActive]}
              onPress={() => setFilterMode('all')}
              testID="filter-all"
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filterMode === 'all' && styles.filterButtonTextActive,
                ]}
              >
                All Projects
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filterMode === 'mine' && styles.filterButtonActive]}
              onPress={() => setFilterMode('mine')}
              testID="filter-mine"
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filterMode === 'mine' && styles.filterButtonTextActive,
                ]}
              >
                My Projects
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filterMode === 'shared' && styles.filterButtonActive]}
              onPress={() => setFilterMode('shared')}
              testID="filter-shared"
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filterMode === 'shared' && styles.filterButtonTextActive,
                ]}
              >
                Shared
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Project Selection */}
        <View style={styles.projectSelectionSection}>
          <Text style={styles.sectionLabel}>Select Projects</Text>
          <View style={styles.projectCheckboxes}>
            {allProjects.map(project => (
              <TouchableOpacity
                key={project.id}
                style={styles.checkboxRow}
                onPress={() => toggleProjectSelection(project)}
                testID={`select-project-${project.id}`}
              >
                <View
                  style={[
                    styles.checkbox,
                    selectedProjects.find(p => p.id === project.id) && styles.checkboxChecked,
                  ]}
                >
                  {selectedProjects.find(p => p.id === project.id) && (
                    <Text style={styles.checkboxMark}>✓</Text>
                  )}
                </View>
                <Text style={styles.checkboxLabel}>{project.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Summary Cards */}
        {dashboardData && (
          <View style={styles.summarySection}>
            <Text style={styles.sectionLabel}>Summary Statistics</Text>
            <View style={styles.summaryCardsRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryNumber}>{dashboardData.totalRecords}</Text>
                <Text style={styles.summaryLabel}>Total Records</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryNumber}>{dashboardData.totalInspections}</Text>
                <Text style={styles.summaryLabel}>Inspections</Text>
              </View>
            </View>
            <View style={styles.summaryCardsRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryNumber}>{dashboardData.totalWorkOrders}</Text>
                <Text style={styles.summaryLabel}>Work Orders</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryNumber}>{dashboardData.totalCompliance}</Text>
                <Text style={styles.summaryLabel}>Compliance</Text>
              </View>
            </View>
          </View>
        )}

        {/* Project Comparison Chart */}
        <View style={styles.chartSection}>
          <Text style={styles.sectionLabel}>Project Comparison</Text>
          <View style={styles.comparisonChart}>
            {selectedProjects.slice(0, 4).map((project, index) => (
              <View key={project.id} style={styles.chartRow}>
                <Text style={styles.chartLabel}>{project.name.substring(0, 10)}</Text>
                <View
                  style={[
                    styles.chartBar,
                    { width: `${30 + index * 20}%` },
                  ]}
                />
                <Text style={styles.chartValue}>{45 + index * 12}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Project Health Overview */}
        <View style={styles.healthSection}>
          <Text style={styles.sectionLabel}>Project Health</Text>
          <View style={styles.healthGrid}>
            {projectHealth.slice(0, 4).map(health => (
              <View key={health.projectId} style={styles.healthCard}>
                <Text style={styles.healthProjectName}>{health.name}</Text>
                <Text style={styles.healthPercentage}>{health.health}%</Text>
                <View style={styles.healthBar}>
                  <View
                    style={[
                      styles.healthBarFill,
                      {
                        width: `${health.health}%`,
                        backgroundColor:
                          health.health >= 80
                            ? '#4CAF50'
                            : health.health >= 60
                            ? '#FF9800'
                            : '#F44336',
                      },
                    ]}
                  />
                </View>
                <Text style={styles.healthStatus}>{health.status}</Text>
                <Text style={styles.healthUpdated}>{health.lastUpdated}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Export Button */}
        <TouchableOpacity style={styles.exportButton} testID="export-dashboard">
          <Text style={styles.exportButtonText}>📊 Export Dashboard</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  dateRangeSection: {
    marginBottom: 16,
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
  filterSection: {
    marginBottom: 16,
  },
  filterButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  projectSelectionSection: {
    marginBottom: 16,
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
  summarySection: {
    marginBottom: 16,
  },
  summaryCardsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  chartSection: {
    marginBottom: 16,
  },
  comparisonChart: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  chartLabel: {
    width: 70,
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  chartBar: {
    height: 20,
    backgroundColor: '#2196F3',
    borderRadius: 3,
  },
  chartValue: {
    width: 30,
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    textAlign: 'right',
  },
  healthSection: {
    marginBottom: 16,
  },
  healthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  healthCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
  },
  healthProjectName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  healthPercentage: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 4,
  },
  healthBar: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  healthBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  healthStatus: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    marginBottom: 2,
  },
  healthUpdated: {
    fontSize: 10,
    color: '#999',
  },
  exportButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
