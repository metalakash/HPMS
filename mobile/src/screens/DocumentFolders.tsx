import React, { useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { ScreenContainer, Header, Card, CardBody, ListItem, Badge, Spacer } from '@/components';

interface Folder {
  id: string;
  name: string;
  category: string;
  documentCount: number;
  color: string;
}

export const DocumentFoldersScreen = ({ navigation }: any) => {
  const [folders] = useState<Folder[]>([
    { id: '1', name: 'Permits', category: 'permit', documentCount: 12, color: '#4CAF50' },
    { id: '2', name: 'Contracts', category: 'contract', documentCount: 8, color: '#2196F3' },
    { id: '3', name: 'Inspections', category: 'inspection', documentCount: 15, color: '#FF9800' },
    { id: '4', name: 'Compliance', category: 'compliance', documentCount: 5, color: '#F44336' },
    { id: '5', name: 'Other', category: 'other', documentCount: 3, color: '#9E9E9E' },
  ]);

  const handleFolderPress = (folder: Folder) => {
    navigation.navigate('FolderContents', { folderId: folder.id, folderName: folder.name });
  };

  return (
    <ScreenContainer scrollable={false}>
      <Header title="Document Folders" />

      <Spacer size="small" />

      <FlatList
        testID="folders-list"
        data={folders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Card onPress={() => handleFolderPress(item)} testID={`folder-${item.id}`}>
            <CardBody>
              <ListItem
                title={item.name}
                subtitle={`${item.documentCount} documents`}
                rightContent={
                  <View style={[styles.folderIcon, { backgroundColor: item.color }]}>
                    📁
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
  folderIcon: {
    width: 40,
    height: 40,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
