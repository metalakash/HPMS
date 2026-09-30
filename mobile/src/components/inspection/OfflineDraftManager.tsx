import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Card, CardBody, ListItem, Button, Badge, Spacer } from '@/components';
import { apiService } from '@/services/api.service';

export interface InspectionDraft {
  id: string;
  projectName: string;
  title: string;
  status: 'draft' | 'pending_sync';
  savedAt: string;
  itemCount: number;
}

interface OfflineDraftManagerProps {
  onLoadDraft: (draft: InspectionDraft) => void;
  onDeleteDraft: (id: string) => void;
  onSyncDraft: (id: string) => void;
}

export const OfflineDraftManager = ({
  onLoadDraft,
  onDeleteDraft,
  onSyncDraft,
}: OfflineDraftManagerProps) => {
  const [drafts, setDrafts] = useState<InspectionDraft[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDrafts();
  }, []);

  const loadDrafts = async () => {
    setLoading(true);
    try {
      const savedDrafts = await apiService.getLocalDrafts();
      setDrafts(savedDrafts);
    } catch (error) {
      console.error('Failed to load drafts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiService.deleteDraft(id);
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      onDeleteDraft(id);
    } catch (error) {
      console.error('Failed to delete draft:', error);
    }
  };

  const handleSync = async (id: string) => {
    try {
      await apiService.syncDraft(id);
      setDrafts((prev) =>
        prev.map((d) =>
          d.id === id ? { ...d, status: 'pending_sync' } : d
        )
      );
      onSyncDraft(id);
    } catch (error) {
      console.error('Failed to sync draft:', error);
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        testID="draft-list"
        data={drafts}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <Card>
            <CardBody>
              <ListItem
                title={item.projectName}
                subtitle={`${item.itemCount} items • ${item.title}`}
                rightContent={
                  <Badge
                    label={item.status === 'pending_sync' ? 'Syncing...' : 'Draft'}
                    variant={item.status === 'pending_sync' ? 'warning' : 'info'}
                    size="small"
                  />
                }
                onPress={() => onLoadDraft(item)}
              />
              <Spacer size="small" />
              <View style={styles.draftActions}>
                <Button
                  title="Delete"
                  onPress={() => handleDelete(item.id)}
                  variant="secondary"
                  size="small"
                  style={styles.actionButton}
                />
                <Button
                  title="Sync"
                  onPress={() => handleSync(item.id)}
                  size="small"
                  style={styles.actionButton}
                />
              </View>
            </CardBody>
          </Card>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  draftActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  actionButton: {
    minWidth: 80,
  },
});
