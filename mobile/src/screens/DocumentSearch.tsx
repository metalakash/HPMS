import React, { useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { ScreenContainer, Header, Card, CardBody, TextInput, ListItem, Badge, Spacer } from '@/components';

interface SearchResult {
  id: string;
  title: string;
  fileName: string;
  category: string;
  uploadedAt: string;
  matchType: 'title' | 'content' | 'filename';
}

export const DocumentSearchScreen = ({ navigation }: any) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Search logic would call API
      const mockResults: SearchResult[] = [
        {
          id: '1',
          title: 'Annual Inspection',
          fileName: 'inspection-2026.pdf',
          category: 'inspection',
          uploadedAt: '2026-09-27',
          matchType: 'title',
        },
        {
          id: '2',
          title: 'License Agreement',
          fileName: 'license.pdf',
          category: 'contract',
          uploadedAt: '2026-09-20',
          matchType: 'content',
        },
      ];
      setResults(mockResults);
    } finally {
      setIsSearching(false);
    }
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

  return (
    <ScreenContainer scrollable={false}>
      <Header title="Search Documents" />

      <Spacer size="small" />

      <Card>
        <CardBody>
          <TextInput
            label="Search"
            placeholder="Search by title, content, or filename"
            value={searchQuery}
            onChangeText={handleSearch}
            autoFocus={true}
          />
        </CardBody>
      </Card>

      {searchQuery.length >= 2 ? (
        <FlatList
          testID="search-results"
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Card onPress={() => navigation.navigate('DocumentPreview', { id: item.id })}>
              <CardBody>
                <ListItem
                  title={item.title}
                  subtitle={`${item.fileName} • ${item.uploadedAt}`}
                  rightContent={
                    <Badge label={item.category} variant={getCategoryColor(item.category)} size="small" />
                  }
                />
              </CardBody>
            </Card>
          )}
        />
      ) : (
        <View style={styles.emptyState}>
          <View style={styles.emptyMessage}>Start typing to search documents</View>
        </View>
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyMessage: {
    fontSize: 14,
    color: '#999',
  },
});
