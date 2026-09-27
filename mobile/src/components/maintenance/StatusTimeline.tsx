import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Badge } from '@/components';

export interface TimelineStatus {
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  timestamp: string;
  notes?: string;
}

interface StatusTimelineProps {
  statuses: TimelineStatus[];
  currentStatus: string;
}

export const StatusTimeline = ({ statuses, currentStatus }: StatusTimelineProps) => {
  const statusOrder = ['pending', 'assigned', 'in_progress', 'completed'];
  const currentIndex = statusOrder.indexOf(currentStatus as any);

  return (
    <View style={styles.container}>
      <View style={styles.timeline}>
        {statusOrder.map((status, index) => (
          <View key={status} style={styles.step}>
            <View
              style={[
                styles.dot,
                index <= currentIndex && styles.activeDot,
              ]}
            />
            {index < statusOrder.length - 1 && (
              <View
                style={[
                  styles.line,
                  index < currentIndex && styles.activeLine,
                ]}
              />
            )}
          </View>
        ))}
      </View>
      <View style={styles.labels}>
        {statusOrder.map((status) => (
          <View key={status} style={styles.label}>
            <Badge label={status} size="small" />
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  timeline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  step: {
    flex: 1,
    alignItems: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#DDD',
    zIndex: 2,
  },
  activeDot: {
    backgroundColor: '#1976D2',
  },
  line: {
    position: 'absolute',
    height: 2,
    backgroundColor: '#DDD',
    width: '100%',
    zIndex: 1,
  },
  activeLine: {
    backgroundColor: '#1976D2',
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  label: {
    alignItems: 'center',
  },
});
