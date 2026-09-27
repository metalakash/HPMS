/**
 * Dashboard - Enhanced with Real-time Updates
 * This file shows the enhanced Dashboard integration with WebSocket
 */

import React, { useEffect, useCallback } from 'react';
import { useProjectUpdates } from '@/hooks/useWebSocket';
import { ProjectUpdate } from '@/services/websocket.service';

/**
 * Enhanced Dashboard with real-time updates
 * Add this to your existing Dashboard component:
 */

// Inside DashboardScreen component:
export const DashboardEnhancements = () => {
  // Listen to real-time project updates
  const handleProjectUpdate = useCallback((update: ProjectUpdate) => {
    console.log('Project updated:', update.data);

    // Update local state with real-time data
    // setMetrics(prev => ({
    //   ...prev,
    //   totalCapacityMw: prev.totalCapacityMw + (update.data.capacityMw || 0),
    // }));

    // Update projects list
    // setProjects(prev =>
    //   prev.map(p =>
    //     p.id === update.data.id
    //       ? { ...p, ...update.data }
    //       : p
    //   )
    // );

    // Show notification badge
    // showNotification(`${update.data.name} updated`);
  }, []);

  useProjectUpdates(handleProjectUpdate);

  return null;
};

/**
 * Example usage in Dashboard component:
 *
 * const Dashboard = () => {
 *   // ... existing Dashboard code ...
 *
 *   // Add real-time updates
 *   <DashboardEnhancements />
 *
 *   // Show real-time status indicator
 *   {isConnected && (
 *     <View style={styles.realtimeIndicator}>
 *       <View style={styles.realtimeDot} />
 *       <Text style={styles.realtimeText}>Live</Text>
 *     </View>
 *   )}
 * }
 */

// Integration points:
const DASHBOARD_REALTIME_INTEGRATION = `
1. Add useProjectUpdates hook to Dashboard
2. Listen to project:update events
3. Update KPI cards in real-time
4. Update project list on changes
5. Show "Live" indicator when connected
6. Handle reconnection gracefully
7. Cache invalidation handled automatically
`;

/**
 * WebSocket event flow in Dashboard:
 *
 * Backend sends: {
 *   type: "update",
 *   entity: "project",
 *   action: "status_changed",
 *   data: { id: "123", status: "active", progress: 75 }
 * }
 *     ↓
 * WebSocket Service receives & parses
 *     ↓
 * Cache invalidation triggered automatically
 *     ↓
 * Event handler called (useProjectUpdates)
 *     ↓
 * Dashboard component re-renders with new data
 *     ↓
 * User sees live updates
 */
