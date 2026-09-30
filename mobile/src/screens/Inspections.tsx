import React, { useState, useEffect } from 'react';
import { View, FlatList, RefreshControl } from 'react-native';
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

interface Inspection {
  id: string;
  projectId: string;
  projectName: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  photoCount: number;
}

export const InspectionsScreen = ({ navigation }: any) => {
  const [refreshing, setRefreshing] = useState(false);
  const { data: inspections, loading, error, retry } = useApi<Inspection[]>(
    () => apiService.getInspections()
  );
  const { isOnline } = useAppStore();

  const handleRefresh = async () => {
    setRefreshing(true);
    await retry();
    setRefreshing(false);
  };

  const handleCreateInspection = () => {
    navigation.navigate('CreateInspection');
  };

  const handleInspectionPress = (inspection: Inspection) => {
    navigation.navigate('InspectionDetail', { id: inspection.id });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'warning';
      case 'submitted':
        return 'info';
      case 'approved':
        return 'success';
      case 'rejected':
        return 'error';
      default:
        return 'default';
    }
  };

  if (loading && !inspections) {
    return <LoadingOverlay visible={true} />;
  }

  if (error) {
    return (
      <ScreenContainer>
        <Header title="Inspections" />
        <ErrorState
          title="Failed to load inspections"
          message={error.message}
          onRetry={retry}
        />
      </ScreenContainer>
    );
  }

  if (!inspections || inspections.length === 0) {
    return (
      <ScreenContainer>
        <Header
          title="Inspections"
          rightAction={{
            icon: 'plus',
            onPress: handleCreateInspection,
          }}
        />
        <EmptyState
          title="No Inspections"
          description="Create your first inspection to get started"
          action={{
            label: 'Create Inspection',
            onPress: handleCreateInspection,
          }}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable={false}>
      <Header
        title="Inspections"
        rightAction={{
          icon: 'plus',
          onPress: handleCreateInspection,
        }}
      />

      {!isOnline && (
        <View style={{ backgroundColor: '#FF9800', paddingVertical: 8 }}>
          <Badge label="Offline" variant="warning" />
        </View>
      )}

      <FlatList
        testID="inspections-list"
        data={inspections}
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
            onPress={() => handleInspectionPress(item)}
            testID={`inspection-item-${item.id}`}
          >
            <CardBody>
              <ListItem
                title={item.projectName}
                subtitle={`${item.itemCount} items • ${item.photoCount} photos`}
                rightContent={
                  <Badge
                    label={item.status}
                    variant={getStatusColor(item.status)}
                    size="small"
                  />
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
