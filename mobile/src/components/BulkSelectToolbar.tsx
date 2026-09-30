/**
 * Bulk Select Toolbar
 * Floating toolbar displayed during bulk selection
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface BulkSelectToolbarProps {
  selectedCount: number;
  totalCount: number;
  visible: boolean;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onProceed: () => void;
  onClose: () => void;
}

export const BulkSelectToolbar: React.FC<BulkSelectToolbarProps> = ({
  selectedCount,
  totalCount,
  visible,
  onSelectAll,
  onClearSelection,
  onProceed,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const slideAnim = React.useRef(new Animated.Value(visible ? 0 : 100)).current;

  React.useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : 100,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible, slideAnim]);

  if (!visible) return null;

  const selectionPercentage = Math.round((selectedCount / totalCount) * 100);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            {
              translateY: slideAnim.interpolate({
                inputRange: [0, 100],
                outputRange: [0, 150],
              }),
            },
          ],
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {/* Selection Summary */}
      <View style={styles.summary}>
        <View>
          <Text style={styles.selectedCount}>{selectedCount} Selected</Text>
          <Text style={styles.totalCount}>{selectedCount} of {totalCount} items</Text>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${selectionPercentage}%` },
            ]}
          />
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={onSelectAll}>
          <Text style={styles.actionButtonIcon}>☑️</Text>
          <Text style={styles.actionButtonText}>Select All</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={onClearSelection}>
          <Text style={styles.actionButtonIcon}>☐</Text>
          <Text style={styles.actionButtonText}>Clear</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.proceedButton]}
          onPress={onProceed}
        >
          <Text style={styles.actionButtonIcon}>➜</Text>
          <Text style={[styles.actionButtonText, styles.proceedText]}>Proceed</Text>
        </TouchableOpacity>
      </View>

      {/* Close Button */}
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeButtonText}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  summary: {
    marginBottom: 12,
  },
  selectedCount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 4,
  },
  totalCount: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1976d2',
    borderRadius: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    gap: 4,
  },
  proceedButton: {
    backgroundColor: '#1976d2',
  },
  actionButtonIcon: {
    fontSize: 14,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#212121',
  },
  proceedText: {
    color: '#fff',
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#999',
    fontWeight: '600',
  },
});
