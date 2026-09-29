/**
 * Report Data Table Component
 * Display report data in table format
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';

interface ReportDataTableComponentProps {
  data: any[];
  columns?: string[];
  title?: string;
  onExport?: () => void;
  showSummary?: boolean;
}

export const ReportDataTableComponent: React.FC<ReportDataTableComponentProps> = ({
  data,
  columns,
  title,
  onExport,
  showSummary = true,
}) => {
  const tableColumns = useMemo(() => {
    if (columns) return columns;
    if (data.length === 0) return [];
    return Object.keys(data[0]);
  }, [data, columns]);

  const summary = useMemo(() => {
    if (!showSummary || data.length === 0) return null;

    const stats: Record<string, any> = {};
    tableColumns.forEach(col => {
      const values = data.map(row => row[col]).filter(v => typeof v === 'number');
      if (values.length > 0) {
        stats[col] = {
          total: values.reduce((a, b) => a + b, 0),
          average: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100,
          min: Math.min(...values),
          max: Math.max(...values),
        };
      }
    });
    return stats;
  }, [data, tableColumns, showSummary]);

  const getCellValue = (value: any): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') return value.toFixed(2);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  };

  return (
    <View style={styles.container}>
      {title && (
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {onExport && (
            <TouchableOpacity style={styles.exportButton} onPress={onExport}>
              <Text style={styles.exportText}>📥 Export</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.table}>
          {/* Header Row */}
          <View style={styles.headerRow}>
            {tableColumns.map((col, i) => (
              <View
                key={i}
                style={[
                  styles.cell,
                  styles.headerCell,
                ]}
              >
                <Text style={styles.headerText}>{col}</Text>
              </View>
            ))}
          </View>

          {/* Data Rows */}
          {data.slice(0, 20).map((row, rowIndex) => (
            <View
              key={rowIndex}
              style={[
                styles.dataRow,
                rowIndex % 2 === 0 && styles.alternateRow,
              ]}
            >
              {tableColumns.map((col, colIndex) => (
                <View
                  key={colIndex}
                  style={styles.cell}
                >
                  <Text style={styles.dataText}>{getCellValue(row[col])}</Text>
                </View>
              ))}
            </View>
          ))}

          {/* Summary Row */}
          {summary && (
            <>
              <View style={styles.summaryRow}>
                {tableColumns.map((col, i) => (
                  <View
                    key={i}
                    style={[styles.cell, styles.summaryCell]}
                  >
                    <Text style={styles.summaryText}>Total</Text>
                  </View>
                ))}
              </View>
              <View style={styles.summaryRow}>
                {tableColumns.map((col, i) => (
                  <View key={i} style={[styles.cell, styles.summaryCell]}>
                    <Text style={styles.summaryValue}>
                      {summary[col]?.total?.toFixed(2) || '-'}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {data.length > 20 && (
        <Text style={styles.moreText}>
          Showing 20 of {data.length} rows
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginVertical: 8,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212121',
  },
  exportButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#E3F2FD',
    borderRadius: 4,
  },
  exportText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976d2',
  },
  table: {
    paddingHorizontal: 8,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 2,
    borderBottomColor: '#e0e0e0',
  },
  headerCell: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 10,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#212121',
  },
  cell: {
    minWidth: 100,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRightWidth: 1,
    borderRightColor: '#f0f0f0',
  },
  dataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  alternateRow: {
    backgroundColor: '#fafafa',
  },
  dataText: {
    fontSize: 12,
    color: '#212121',
  },
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderTopWidth: 2,
    borderTopColor: '#e0e0e0',
  },
  summaryCell: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 10,
  },
  summaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1976d2',
  },
  moreText: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
});
