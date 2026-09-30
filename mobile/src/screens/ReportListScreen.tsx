/**
 * Report List Screen
 * View, manage, and share generated/saved reports
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import { Button } from '../components/Button';

interface Report {
  id: string;
  name: string;
  type: 'template' | 'generated';
  format: string;
  generatedDate: string;
  fileSize: string;
  generatedBy: string;
  sharedWith: number;
}

const SAMPLE_REPORTS: Report[] = [
  {
    id: '1',
    name: 'Monthly Inspection Report',
    type: 'generated',
    format: 'PDF',
    generatedDate: '2026-09-28',
    fileSize: '2.4 MB',
    generatedBy: 'You',
    sharedWith: 0,
  },
  {
    id: '2',
    name: 'Maintenance Summary Q3',
    type: 'generated',
    format: 'Excel',
    generatedDate: '2026-09-27',
    fileSize: '1.2 MB',
    generatedBy: 'You',
    sharedWith: 2,
  },
];

interface ReportListScreenProps {
  reports?: Report[];
  onDownload?: (reportId: string) => void;
  onDelete?: (reportId: string) => void;
  onShare?: (reportId: string) => void;
  onRegenerate?: (reportId: string) => void;
}

export const ReportListScreen: React.FC<ReportListScreenProps> = ({
  reports = SAMPLE_REPORTS,
  onDownload,
  onDelete,
  onShare,
  onRegenerate,
}) => {
  const insets = useSafeAreaInsets();
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size'>('date');

  const sortedReports = [...reports].sort((a, b) => {
    if (sortBy === 'date') {
      return new Date(b.generatedDate).getTime() - new Date(a.generatedDate).getTime();
    } else if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    } else {
      const sizeA = parseInt(a.fileSize);
      const sizeB = parseInt(b.fileSize);
      return sizeB - sizeA;
    }
  });

  const renderReportItem = ({ item }: { item: Report }) => (
    <Card key={item.id} style={styles.reportCard}>
      <TouchableOpacity style={styles.reportContent}>
        <View style={styles.reportHeader}>
          <View style={styles.reportInfo}>
            <Text style={styles.reportName}>{item.name}</Text>
            <View style={styles.reportMeta}>
              <Text style={styles.metaText}>{item.format}</Text>
              <Text style={styles.separator}>•</Text>
              <Text style={styles.metaText}>{item.fileSize}</Text>
              <Text style={styles.separator}>•</Text>
              <Text style={styles.metaText}>{item.generatedDate}</Text>
            </View>
          </View>
          {item.sharedWith > 0 && (
            <View style={styles.sharedBadge}>
              <Text style={styles.sharedBadgeText}>👥 {item.sharedWith}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      <View style={styles.actions}>
        <Button
          label="Download"
          onPress={() => onDownload?.(item.id)}
          style={styles.actionButton}
        />
        <Button
          label="Share"
          onPress={() => onShare?.(item.id)}
          style={[styles.actionButton, styles.secondaryButton]}
        />
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => onDelete?.(item.id)}
        >
          <Text style={styles.deleteButtonText}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Reports</Text>
      </View>

      <View style={styles.sortContainer}>
        {(['date', 'name', 'size'] as const).map(sort => (
          <TouchableOpacity
            key={sort}
            style={[
              styles.sortButton,
              sortBy === sort && styles.sortButtonActive,
            ]}
            onPress={() => setSortBy(sort)}
          >
            <Text style={[
              styles.sortButtonText,
              sortBy === sort && styles.sortButtonTextActive,
            ]}>
              {sort === 'date' ? 'Date' : sort === 'name' ? 'Name' : 'Size'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {reports.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📄</Text>
          <Text style={styles.emptyTitle}>No Reports</Text>
          <Text style={styles.emptyMessage}>Generate your first report to see it here</Text>
        </View>
      ) : (
        <FlatList
          data={sortedReports}
          renderItem={renderReportItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          scrollEnabled={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
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
  sortContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#fff',
    gap: 8,
  },
  sortButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    alignItems: 'center',
  },
  sortButtonActive: {
    backgroundColor: '#1976d2',
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  sortButtonTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
  },
  reportCard: {
    marginBottom: 0,
  },
  reportContent: {
    paddingVertical: 12,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  reportInfo: {
    flex: 1,
  },
  reportName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 4,
  },
  reportMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 11,
    color: '#999',
  },
  separator: {
    fontSize: 8,
    color: '#ccc',
  },
  sharedBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  sharedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    marginBottom: 0,
    paddingVertical: 8,
    fontSize: 12,
  },
  secondaryButton: {
    backgroundColor: '#f0f0f0',
  },
  deleteButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  deleteButtonText: {
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
