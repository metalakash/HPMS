import React, { useState } from 'react';
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
} from '@/components';

interface Document {
  id: string;
  projectId: string;
  title: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  category: string;
  uploadedBy: string;
  uploadedAt: string;
  url: string;
}

export const DocumentsScreen = ({ navigation }: any) => {
  const [refreshing, setRefreshing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');

  const { data: documents, loading, error, retry } = useApi<Document[]>(
    () => apiService.getProjectDocuments()
  );
  const { isOnline } = useAppStore();

  const handleRefresh = async () => {
    setRefreshing(true);
    await retry();
    setRefreshing(false);
  };

  const handleUpload = () => {
    navigation.navigate('UploadDocument');
  };

  const handleDocumentPress = (doc: Document) => {
    navigation.navigate('DocumentPreview', { id: doc.id });
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      permit: 'success',
      contract: 'info',
      inspection: 'warning',
      compliance: 'error',
      other: 'default',
    };
    return colors[category] || 'default';
  };

  const filteredDocs = documents?.filter((doc) => {
    if (categoryFilter === 'all') return true;
    return doc.category === categoryFilter;
  }) || [];

  if (loading && !documents) {
    return <LoadingOverlay visible={true} />;
  }

  if (error) {
    return (
      <ScreenContainer>
        <Header title="Documents" />
        <ErrorState title="Failed to load documents" message={error.message} onRetry={retry} />
      </ScreenContainer>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <ScreenContainer>
        <Header
          title="Documents"
          rightAction={{ icon: 'plus', onPress: handleUpload }}
        />
        <EmptyState
          title="No Documents"
          description="Upload your first project document"
          action={{ label: 'Upload Document', onPress: handleUpload }}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable={false}>
      <Header
        title="Documents"
        rightAction={{ icon: 'plus', onPress: handleUpload }}
      />

      {!isOnline && (
        <View style={styles.offlineBar}>
          <Badge label="Offline" variant="warning" />
        </View>
      )}

      <FlatList
        testID="documents-list"
        data={filteredDocs}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        renderItem={({ item }) => (
          <Card onPress={() => handleDocumentPress(item)} testID={`doc-item-${item.id}`}>
            <CardBody>
              <ListItem
                title={item.title}
                subtitle={`${item.fileType} • ${(item.fileSize / 1024 / 1024).toFixed(2)}MB`}
                rightContent={
                  <Badge label={item.category} variant={getCategoryColor(item.category)} size="small" />
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
});
