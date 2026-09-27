import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ScreenContainer, Header, Card, CardHeader, CardBody, Badge, Button, Spacer } from '@/components';

interface WorkOrderDetailProps {
  route: {
    params: {
      id: string;
    };
  };
  navigation: any;
}

export const WorkOrderDetailScreen = ({ route, navigation }: WorkOrderDetailProps) => {
  const { id } = route.params;

  // Mock work order data - would be fetched from API
  const workOrder = {
    id,
    title: 'Pump Maintenance',
    projectName: 'Hydro Dam A',
    type: 'Preventive',
    priority: 'high',
    status: 'in_progress',
    assignedTo: 'John Smith, Jane Doe',
    estimatedCost: 5000,
    actualCost: 4500,
    dueDate: '2026-10-15',
    createdAt: '2026-09-27',
    description: 'Annual pump maintenance and inspection',
    progress: 75,
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
      default:
        return 'default';
    }
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

  const handleUpdate = () => {
    navigation.navigate('UpdateWorkOrder', { workOrder });
  };

  const handleComplete = () => {
    navigation.navigate('CompleteWorkOrder', { workOrder });
  };

  return (
    <ScreenContainer scrollable>
      <Header title="Work Order Details" />

      <Spacer size="medium" />

      {/* Summary */}
      <Card>
        <CardHeader>
          <View style={styles.headerContent}>
            <View>
              <Badge label={workOrder.type} size="small" />
            </View>
            <View style={styles.badges}>
              <Badge label={workOrder.priority} variant={getPriorityColor(workOrder.priority)} size="small" />
              <Badge label={workOrder.status} variant={getStatusColor(workOrder.status)} size="small" />
            </View>
          </View>
        </CardHeader>
        <CardBody>
          <View style={styles.row}>
            <View style={styles.label}>Title:</View>
            <View style={styles.value}>{workOrder.title}</View>
          </View>
          <View style={styles.row}>
            <View style={styles.label}>Project:</View>
            <View style={styles.value}>{workOrder.projectName}</View>
          </View>
        </CardBody>
      </Card>

      <Spacer size="small" />

      {/* Details */}
      <Card>
        <CardBody>
          <View style={styles.row}>
            <View style={styles.label}>Assigned To:</View>
            <View style={styles.value}>{workOrder.assignedTo}</View>
          </View>
          <View style={styles.row}>
            <View style={styles.label}>Due Date:</View>
            <View style={styles.value}>{workOrder.dueDate}</View>
          </View>
          <View style={styles.row}>
            <View style={styles.label}>Estimated Cost:</View>
            <View style={styles.value}>${workOrder.estimatedCost.toLocaleString()}</View>
          </View>
          <View style={styles.row}>
            <View style={styles.label}>Actual Cost:</View>
            <View style={styles.value}>${workOrder.actualCost?.toLocaleString() || 'N/A'}</View>
          </View>
        </CardBody>
      </Card>

      <Spacer size="small" />

      {/* Description */}
      <Card>
        <CardHeader>Description</CardHeader>
        <CardBody>
          <View style={styles.description}>{workOrder.description}</View>
        </CardBody>
      </Card>

      <Spacer size="medium" />

      {/* Actions */}
      {workOrder.status !== 'completed' && (
        <View style={styles.buttonContainer}>
          <Button
            title="Update"
            onPress={handleUpdate}
            variant="secondary"
            style={styles.button}
          />
          <Button
            title="Complete"
            onPress={handleComplete}
            style={styles.button}
          />
        </View>
      )}

      <Spacer size="large" />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  label: {
    flex: 1,
    fontWeight: '600',
    paddingRight: 10,
  },
  value: {
    flex: 2,
    color: '#666',
  },
  description: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
  },
  button: {
    flex: 1,
  },
});
