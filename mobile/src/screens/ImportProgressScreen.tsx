/**
 * Import Progress Screen
 * Track import progress with conflict detection
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';

interface ImportProgressScreenProps {
  config?: any;
  onComplete?: () => void;
}

export const ImportProgressScreen: React.FC<ImportProgressScreenProps> = ({
  config,
  onComplete,
}) => {
  const [progress, setProgress] = useState(0);
  const [processedRecords, setProcessedRecords] = useState(0);
  const [totalRecords] = useState(50);
  const [conflicts, setConflicts] = useState(8);
  const [errors, setErrors] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);

  useEffect(() => {
    if (paused) return;

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          onComplete?.();
          return 100;
        }
        return Math.min(prev + Math.random() * 4 + 1, 100);
      });

      setProcessedRecords(prev => {
        const next = Math.min(prev + 2, totalRecords);
        if (Math.random() > 0.92) {
          setConflicts(c => Math.max(c - 1, 0));
        }
        return next;
      });
    }, 600);

    return () => clearInterval(interval);
  }, [paused, totalRecords, onComplete]);

  const handleResolveConflict = () => {
    setShowConflictDialog(false);
    setConflicts(c => Math.max(c - 1, 0));
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.title}>Importing Data</Text>

        <View style={styles.progressBox}>
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                { width: `${progress}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>{Math.round(progress)}%</Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Processed</Text>
            <Text style={styles.statValue}>
              {processedRecords} / {totalRecords}
            </Text>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Conflicts</Text>
            <Text style={[styles.statValue, conflicts > 0 && styles.statWarning]}>
              {conflicts}
            </Text>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Errors</Text>
            <Text style={[styles.statValue, errors > 0 && styles.statError]}>
              {errors}
            </Text>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Status</Text>
            <Text style={styles.statValue}>
              {progress === 100 ? 'Complete' : 'Running'}
            </Text>
          </View>
        </View>
      </View>

      {conflicts > 0 && (
        <View style={[styles.section, styles.conflictSection]}>
          <Text style={styles.conflictTitle}>⚠️ {conflicts} Conflicts Detected</Text>
          <Text style={styles.conflictDescription}>
            These records conflict with existing data
          </Text>

          <View style={styles.conflictList}>
            {[...Array(Math.min(conflicts, 3))].map((_, idx) => (
              <View key={idx} style={styles.conflictItem}>
                <Text style={styles.conflictRecord}>
                  Record #{100 + idx * 5}: Duplicate entry
                </Text>
                <TouchableOpacity
                  style={styles.resolveButton}
                  onPress={() => setShowConflictDialog(true)}
                >
                  <Text style={styles.resolveButtonText}>Review</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {conflicts > 3 && (
            <Text style={styles.moreConflicts}>
              +{conflicts - 3} more conflicts
            </Text>
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Import Details</Text>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>File</Text>
          <Text style={styles.detailValue}>data.csv</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Feature</Text>
          <Text style={styles.detailValue}>Projects</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Strategy</Text>
          <Text style={styles.detailValue}>Merge</Text>
        </View>
      </View>

      <View style={styles.buttonGroup}>
        <TouchableOpacity
          style={[styles.button, paused && styles.buttonActive]}
          onPress={() => setPaused(!paused)}
        >
          <Text style={styles.buttonText}>
            {paused ? 'Resume' : 'Pause'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.buttonDanger]}>
          <Text style={styles.buttonText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {progress === 100 && (
        <View style={styles.completionBox}>
          <Text style={styles.completionIcon}>✓</Text>
          <Text style={styles.completionTitle}>Import Complete</Text>
          <Text style={styles.completionText}>
            {processedRecords} records imported successfully
          </Text>
          {conflicts > 0 && (
            <Text style={styles.completionWarning}>
              {conflicts} conflicts were resolved
            </Text>
          )}
          <TouchableOpacity style={styles.viewResultsButton}>
            <Text style={styles.viewResultsButtonText}>View Results</Text>
          </TouchableOpacity>
        </View>
      )}

      {showConflictDialog && (
        <View style={styles.conflictDialogOverlay}>
          <View style={styles.conflictDialog}>
            <Text style={styles.conflictDialogTitle}>Resolve Conflict</Text>

            <View style={styles.conflictCompare}>
              <View style={styles.conflictSide}>
                <Text style={styles.conflictSideTitle}>Existing</Text>
                <Text style={styles.conflictData}>Project A</Text>
                <Text style={styles.conflictData}>Status: Active</Text>
              </View>

              <View style={styles.conflictSeparator}>→</View>

              <View style={styles.conflictSide}>
                <Text style={styles.conflictSideTitle}>New</Text>
                <Text style={styles.conflictData}>Project A</Text>
                <Text style={styles.conflictData}>Status: Pending</Text>
              </View>
            </View>

            <View style={styles.conflictButtons}>
              <TouchableOpacity
                style={[styles.conflictButton, styles.conflictButtonKeep]}
              >
                <Text style={styles.conflictButtonText}>Keep Existing</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.conflictButton, styles.conflictButtonReplace]}
                onPress={handleResolveConflict}
              >
                <Text style={styles.conflictButtonText}>Use New</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowConflictDialog(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
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
  conflictSection: {
    backgroundColor: '#FFF3E0',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 16,
  },
  progressBox: {
    marginBottom: 16,
  },
  progressBarContainer: {
    height: 24,
    backgroundColor: '#e0e0e0',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#1976d2',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1976d2',
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statItem: {
    flex: 1,
    minWidth: '48%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#212121',
  },
  statWarning: {
    color: '#f57c00',
  },
  statError: {
    color: '#d32f2f',
  },
  conflictTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f57c00',
    marginBottom: 4,
  },
  conflictDescription: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
  },
  conflictList: {
    gap: 8,
  },
  conflictItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
    borderRadius: 4,
  },
  conflictRecord: {
    fontSize: 12,
    color: '#212121',
    flex: 1,
  },
  resolveButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1976d2',
    borderRadius: 4,
  },
  resolveButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  moreConflicts: {
    fontSize: 12,
    color: '#f57c00',
    marginTop: 8,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 12,
    color: '#999',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#212121',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#1976d2',
    borderRadius: 4,
  },
  buttonActive: {
    backgroundColor: '#f57c00',
  },
  buttonDanger: {
    backgroundColor: '#d32f2f',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  completionBox: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
  },
  completionIcon: {
    fontSize: 48,
    color: '#388e3c',
    marginBottom: 12,
  },
  completionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 8,
  },
  completionText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  completionWarning: {
    fontSize: 12,
    color: '#f57c00',
    marginBottom: 12,
  },
  viewResultsButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: '#388e3c',
    borderRadius: 4,
  },
  viewResultsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  conflictDialogOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  conflictDialog: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    width: '85%',
    maxWidth: 400,
  },
  conflictDialogTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 12,
    textAlign: 'center',
  },
  conflictCompare: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  conflictSide: {
    flex: 1,
    paddingHorizontal: 8,
  },
  conflictSideTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    marginBottom: 8,
  },
  conflictData: {
    fontSize: 12,
    color: '#212121',
    marginBottom: 4,
  },
  conflictSeparator: {
    fontSize: 18,
    color: '#e0e0e0',
  },
  conflictButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  conflictButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 4,
    borderWidth: 1,
  },
  conflictButtonKeep: {
    borderColor: '#999',
  },
  conflictButtonReplace: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2',
  },
  conflictButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#212121',
    textAlign: 'center',
  },
  closeButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 12,
    color: '#666',
  },
});
