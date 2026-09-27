import React, { useState, useEffect } from 'react';
import { View, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useApi } from '@/hooks/useApi';
import { apiService } from '@/services/api.service';
import useAppStore from '@/store/app.store';
import {
  ScreenContainer,
  Header,
  Card,
  CardBody,
  ListItem,
  Badge,
  LoadingOverlay,
  ErrorState,
  EmptyState,
  Spacer,
} from '@/components';

interface WorkOrder {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  assignedTo?: string;
  estimatedCost?: number;
  actualCost?: number;
  dueDate: string;
  completedDate?: string;
  createdAt: string;
  updatedAt: string;
}

export const MaintenanceScreen = ({ navigation }: any) => {
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: workOrders, loading, error, retry } = useApi<WorkOrder[]>(
    () => apiService.getMaintenanceWorkOrders()
  );
  const { isOnline } = useAppStore();

  const handleRefresh = async () => {
    setRefreshing(true);
    await retry();
    setRefreshing(false);
  };

  const handleCreateWorkOrder = () => {
    navigation.navigate('CreateWorkOrder');
  };

  const handleWorkOrderPress = (workOrder: WorkOrder) => {
    navigation.navigate('WorkOrderDetail', { id: workOrder.id });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'success';
      default:
        return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in_progress':
        return 'info';
      case 'assigned':
        return 'warning';
      case 'pending':
        return 'warning';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  const filteredOrders = workOrders?.filter((order) => {
    if (statusFilter === 'all') return true;
    return order.status === statusFilter;
  }) || [];

  if (loading && !workOrders) {
    return <LoadingOverlay visible={true} />;
  }

  if (error) {
    return (
      <ScreenContainer>
        <Header title="Maintenance Work Orders" />
        <ErrorState
          title="Failed to load work orders"
          message={error.message}
          onRetry={retry}
        />
      </ScreenContainer>
    );
  }

  if (!workOrders || workOrders.length === 0) {
    return (
      <ScreenContainer>
        <Header
          title="Maintenance Work Orders"
          rightAction={{
            icon: 'plus',
            onPress: handleCreateWorkOrder,
          }}
        />
        <EmptyState
          title="No Work Orders"
          description="Create your first maintenance work order"
          action={{
            label: 'Create Work Order',
            onPress: handleCreateWorkOrder,
          }}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable={false}>
      <Header
        title="Maintenance Work Orders"
        rightAction={{
          icon: 'plus',
          onPress: handleCreateWorkOrder,
        }}
      />

      {!isOnline && (
        <View style={styles.offlineBar}>
          <Badge label="Offline" variant="warning" />
        </View>
      )}

      {/* Filter tabs */}
      <View style={styles.filterTabs}>
        {['all', 'pending', 'assigned', 'in_progress', 'completed'].map((status) => (
          <Badge
            key={status}
            label={status}
            variant={statusFilter === status ? 'info' : 'default'}
            onPress={() => setStatusFilter(status)}
            size="small"
          />
        ))}
      </View>

      <FlatList
        testID="work-orders-list"
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#1976D2"
          />
        }
        renderItem={({ item }) => (
          <Card
            onPress={() => handleWorkOrderPress(item)}
            testID={`work-order-item-${item.id}`}
          >
            <CardBody>
              <ListItem
                title={item.title}
                subtitle={`${item.projectName} • Due: ${item.dueDate}`}
                rightContent={
                  <View style={styles.rightContent}>
                    <Badge
                      label={item.priority}
                      variant={getPriorityColor(item.priority)}
                      size="small"
                    />
                    <Badge
                      label={item.status}
                      variant={getStatusColor(item.status)}
                      size="small"
                    />
                  </View>
                }
              />
            </CardBody>
          </Card>
        )}
        scrollEnabled={true}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  offlineBar: {
    backgroundColor: '#FF9800',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  filterTabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  rightContent: {
    gap: 8,
  },
});
