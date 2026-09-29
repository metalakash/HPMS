/**
 * Search Results Screen
 * Display search results grouped by feature with highlighting and navigation
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SectionList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';

interface SearchResult {
  id: string;
  type: 'inspection' | 'maintenance' | 'document' | 'covenant' | 'analytics';
  title: string;
  snippet: string;
  metadata: Record<string, any>;
  relevanceScore: number;
}

interface SearchResultsScreenProps {
  results: SearchResult[];
  query: string;
  loading: boolean;
  onNavigate: (type: string, id: string) => void;
  onRefine: () => void;
}

export const SearchResultsScreen: React.FC<SearchResultsScreenProps> = ({
  results,
  query,
  loading,
  onNavigate,
  onRefine,
}) => {
  const insets = useSafeAreaInsets();
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);

  const typeIcons: Record<string, string> = {
    inspection: '📋',
    maintenance: '🔧',
    document: '📄',
    covenant: '📑',
    analytics: '📊',
  };

  const typeLabels: Record<string, string> = {
    inspection: 'Inspections',
    maintenance: 'Maintenance',
    document: 'Documents',
    covenant: 'Covenants',
    analytics: 'Analytics',
  };

  // Group results by type
  const groupedResults = useMemo(() => {
    const grouped: Record<string, SearchResult[]> = {};

    results.forEach(result => {
      if (!grouped[result.type]) {
        grouped[result.type] = [];
      }
      grouped[result.type].push(result);
    });

    return Object.entries(grouped).map(([type, items]) => ({
      title: typeLabels[type],
      icon: typeIcons[type],
      type: type,
      data: items,
    }));
  }, [results]);

  // Highlight query in text
  const highlightText = useCallback(
    (text: string) => {
      const parts = text.split(new RegExp(`(${query})`, 'gi'));

      return parts.map((part, index) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <Text key={index} style={styles.highlighted}>
            {part}
          </Text>
        ) : (
          <Text key={index}>{part}</Text>
        )
      );
    },
    [query]
  );

  const renderResultItem = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => {
        setSelectedResult(item);
        onNavigate(item.type, item.id);
      }}
    >
      <Card style={styles.resultCard}>
        <View style={styles.resultHeader}>
          <View style={styles.resultTitleContainer}>
            <Text style={styles.resultTitle} numberOfLines={2}>
              {highlightText(item.title)}
            </Text>
            <Text style={styles.relevanceScore}>
              {Math.round(item.relevanceScore * 100)}% match
            </Text>
          </View>
          <Text style={styles.resultArrow}>›</Text>
        </View>

        <Text style={styles.resultSnippet} numberOfLines={2}>
          {highlightText(item.snippet)}
        </Text>

        {Object.entries(item.metadata).length > 0 && (
          <View style={styles.metadataContainer}>
            {Object.entries(item.metadata)
              .slice(0, 2)
              .map(([key, value]) => (
                <Badge
                  key={key}
                  label={`${key}: ${value}`}
                  style={styles.metadataBadge}
                />
              ))}
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section }: any) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionIcon}>{section.icon}</Text>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <Badge label={section.data.length.toString()} />
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🔍</Text>
      <Text style={styles.emptyTitle}>No Results Found</Text>
      <Text style={styles.emptyMessage}>
        Try adjusting your search terms or filters
      </Text>
      <TouchableOpacity style={styles.refineButton} onPress={onRefine}>
        <Text style={styles.refineButtonText}>Refine Search</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Search Results</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Search Results</Text>
          <Text style={styles.queryText}>
            {results.length} results for "{query}"
          </Text>
        </View>
        <TouchableOpacity onPress={onRefine} style={styles.filterButton}>
          <Text style={styles.filterButtonText}>⚙️ Filter</Text>
        </TouchableOpacity>
      </View>

      {/* Results */}
      {results.length === 0 ? (
        renderEmptyState()
      ) : (
        <SectionList
          sections={groupedResults}
          keyExtractor={(item, index) => item.id + index}
          renderItem={renderResultItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
        />
      )}

      {/* Result Details Panel */}
      {selectedResult && (
        <View style={styles.detailsPanel}>
          <Text style={styles.detailsTitle}>{selectedResult.title}</Text>
          <Text style={styles.detailsType}>{typeLabels[selectedResult.type]}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
  },
  queryText: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976d2',
  },
  listContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: '#fff',
    marginBottom: 4,
    borderRadius: 6,
  },
  sectionIcon: {
    fontSize: 18,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  resultItem: {
    marginHorizontal: 8,
    marginVertical: 4,
  },
  resultCard: {
    marginBottom: 0,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  resultTitleContainer: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 4,
  },
  highlighted: {
    backgroundColor: '#fff3cd',
    fontWeight: '700',
  },
  relevanceScore: {
    fontSize: 11,
    color: '#1976d2',
    fontWeight: '600',
  },
  resultArrow: {
    fontSize: 20,
    color: '#999',
  },
  resultSnippet: {
    fontSize: 13,
    color: '#666',
    marginVertical: 8,
    lineHeight: 18,
  },
  metadataContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 8,
  },
  metadataBadge: {
    marginBottom: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 24,
  },
  refineButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#1976d2',
    borderRadius: 6,
  },
  refineButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  detailsPanel: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#e3f2fd',
    borderTopWidth: 1,
    borderTopColor: '#90caf9',
  },
  detailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1565c0',
  },
  detailsType: {
    fontSize: 11,
    color: '#1976d2',
    marginTop: 4,
  },
});
