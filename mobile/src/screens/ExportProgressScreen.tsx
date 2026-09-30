/**
 * Export Progress Screen
 * Track export progress with real-time updates
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';

interface ExportProgressScreenProps {
  config?: any;
  onComplete?: () => void;
}

export const ExportProgressScreen: React.FC<ExportProgressScreenProps> = ({
  config,
  onComplete,
}) => {
  const [progress, setProgress] = useState(0);
  const [currentFeature, setCurrentFeature] = useState('projects');
  const [totalRecords, setTotalRecords] = useState(0);
  const [processedRecords, setProcessedRecords] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [startTime] = useState(Date.now());

  const features = ['projects', 'inspections', 'workorders', 'compliance', 'reports'];
  const featureCounts: Record<string, number> = {
    projects: 45,
    inspections: 128,
    workorders: 67,
    compliance: 34,
    reports: 12,
  };

  useEffect(() => {
    if (paused) return;

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          onComplete?.();
          return 100;
        }
        const increment = Math.random() * 3 + 2;
        return Math.min(prev + increment, 100);
      });

      setProcessedRecords(prev => Math.min(prev + 5, totalRecords));
      setSpeed(((processedRecords / (Date.now() - startTime)) * 1000).toFixed(1));
    }, 500);

    return () => clearInterval(interval);
  }, [paused, totalRecords, processedRecords, startTime, onComplete]);

  useEffect(() => {
    const total = Object.values(featureCounts).reduce((a, b) => a + b, 0);
    setTotalRecords(total);
  }, []);

  const getTimeRemaining = () => {
    const elapsedMs = Date.now() - startTime;
    const remainingRecords = totalRecords - processedRecords;
    const speedPerMs = processedRecords / elapsedMs;
    const remainingMs = speedPerMs > 0 ? remainingRecords / speedPerMs : 0;
    const seconds = Math.ceil(remainingMs / 1000);

    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const estimatedSize = (processedRecords * 500);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.title}>Exporting Data</Text>

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
            <Text style={styles.statLabel}>Speed</Text>
            <Text style={styles.statValue}>{speed} rec/s</Text>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Size</Text>
            <Text style={styles.statValue}>{formatSize(estimatedSize)}</Text>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Remaining</Text>
            <Text style={styles.statValue}>{getTimeRemaining()}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Feature</Text>
        <Text style={styles.currentFeature}>{currentFeature.toUpperCase()}</Text>

        <View style={styles.featureProgress}>
          {features.map((feat, idx) => (
            <View key={feat} style={styles.featureDot}>
              <View
                style={[
                  styles.dot,
                  feat === currentFeature && styles.dotActive,
                  idx < features.indexOf(currentFeature) && styles.dotCompleted,
                ]}
              />
              <Text style={styles.featureName}>{feat}</Text>
            </View>
          ))}
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
          <Text style={styles.completionTitle}>Export Complete</Text>
          <Text style={styles.completionText}>
            {totalRecords} records exported
          </Text>
          <Text style={styles.completionSize}>
            File size: {formatSize(estimatedSize)}
          </Text>
          <TouchableOpacity style={styles.downloadButton}>
            <Text style={styles.downloadButtonText}>Download File</Text>
          </TouchableOpacity>
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
    backgroundColor: '#388e3c',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#388e3c',
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 12,
  },
  currentFeature: {
    fontSize: 18,
    fontWeight: '700',
    color: '#388e3c',
    marginBottom: 12,
  },
  featureProgress: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  featureDot: {
    flex: 1,
    alignItems: 'center',
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
    marginBottom: 8,
  },
  dotActive: {
    backgroundColor: '#1976d2',
  },
  dotCompleted: {
    backgroundColor: '#388e3c',
  },
  featureName: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
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
  completionSize: {
    fontSize: 12,
    color: '#999',
    marginBottom: 16,
  },
  downloadButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: '#388e3c',
    borderRadius: 4,
  },
  downloadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
