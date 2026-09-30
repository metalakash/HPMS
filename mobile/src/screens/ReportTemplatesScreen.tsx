/**
 * Report Templates Screen
 * Browse and select from predefined report templates
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';

type TemplateCategory = 'inspection' | 'maintenance' | 'compliance' | 'analytics' | 'custom';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  feature: string;
  rating?: number;
  usageCount: number;
  estimatedTime: string;
  fieldsCount: number;
  hasChart: boolean;
}

interface ReportTemplatesScreenProps {
  templates?: ReportTemplate[];
  loading?: boolean;
  onSelectTemplate: (template: ReportTemplate) => void;
  onCreateCustom: () => void;
  onViewDetails: (template: ReportTemplate) => void;
}

const SAMPLE_TEMPLATES: ReportTemplate[] = [
  {
    id: '1',
    name: 'Inspection Summary',
    description: 'Overview of all inspections in date range',
    category: 'inspection',
    feature: 'inspections',
    rating: 4.8,
    usageCount: 1250,
    estimatedTime: '2-5s',
    fieldsCount: 8,
    hasChart: true,
  },
  {
    id: '2',
    name: 'Maintenance Work Orders',
    description: 'Track maintenance tasks and completion status',
    category: 'maintenance',
    feature: 'maintenance',
    rating: 4.5,
    usageCount: 890,
    estimatedTime: '3-8s',
    fieldsCount: 10,
    hasChart: true,
  },
  {
    id: '3',
    name: 'Compliance Status',
    description: 'Covenant compliance tracking and alerts',
    category: 'compliance',
    feature: 'covenants',
    rating: 4.9,
    usageCount: 2100,
    estimatedTime: '1-3s',
    fieldsCount: 6,
    hasChart: false,
  },
  {
    id: '4',
    name: 'Monthly Analytics',
    description: 'Key metrics and trends for the month',
    category: 'analytics',
    feature: 'analytics',
    rating: 4.7,
    usageCount: 1560,
    estimatedTime: '5-10s',
    fieldsCount: 12,
    hasChart: true,
  },
];

export const ReportTemplatesScreen: React.FC<ReportTemplatesScreenProps> = ({
  templates = SAMPLE_TEMPLATES,
  loading = false,
  onSelectTemplate,
  onCreateCustom,
  onViewDetails,
}) => {
  const insets = useSafeAreaInsets();
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const categoryIcons: Record<TemplateCategory, string> = {
    inspection: '📋',
    maintenance: '🔧',
    compliance: '✓',
    analytics: '📊',
    custom: '⭐',
  };

  const categoryLabels: Record<TemplateCategory, string> = {
    inspection: 'Inspection',
    maintenance: 'Maintenance',
    compliance: 'Compliance',
    analytics: 'Analytics',
    custom: 'Custom',
  };

  const filteredTemplates = useMemo(() => {
    return templates.filter(template => {
      const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
      const matchesSearch = !searchQuery ||
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [templates, selectedCategory, searchQuery]);

  const renderTemplateCard = ({ item }: { item: ReportTemplate }) => (
    <Card key={item.id} style={[styles.templateCard, viewMode === 'list' && styles.templateCardList]}>
      <TouchableOpacity
        style={styles.cardContent}
        onPress={() => onViewDetails(item)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.titleSection}>
            <Text style={styles.templateName}>{item.name}</Text>
            <Badge label={categoryIcons[item.category]} />
          </View>
          {item.hasChart && <Text style={styles.chartIndicator}>📊</Text>}
        </View>

        <Text style={styles.description} numberOfLines={2}>{item.description}</Text>

        <View style={styles.cardFooter}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Fields:</Text>
            <Text style={styles.infoValue}>{item.fieldsCount}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Time:</Text>
            <Text style={styles.infoValue}>{item.estimatedTime}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Uses:</Text>
            <Text style={styles.infoValue}>{item.usageCount}</Text>
          </View>
        </View>

        {item.rating && (
          <View style={styles.ratingContainer}>
            <Text style={styles.stars}>⭐ {item.rating}</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.actions}>
        <Button
          label="Preview"
          onPress={() => onViewDetails(item)}
          style={styles.previewButton}
        />
        <Button
          label="Use"
          onPress={() => onSelectTemplate(item)}
          style={styles.useButton}
        />
      </View>
    </Card>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📋</Text>
      <Text style={styles.emptyTitle}>No Templates Found</Text>
      <Text style={styles.emptyMessage}>
        {searchQuery ? 'Try a different search' : 'No templates available'}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Report Templates</Text>
        <Button
          label="Create Custom"
          onPress={onCreateCustom}
          style={styles.createButton}
        />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search templates..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
      </View>

      {/* Category Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryTabs}
        contentContainerStyle={styles.categoryTabsContent}
      >
        {(['all', 'inspection', 'maintenance', 'compliance', 'analytics', 'custom'] as const).map(
          category => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryTab,
                selectedCategory === category && styles.categoryTabActive,
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text style={[
                styles.categoryTabText,
                selectedCategory === category && styles.categoryTabTextActive,
              ]}>
                {category === 'all'
                  ? 'All'
                  : `${categoryIcons[category as TemplateCategory]} ${categoryLabels[category as TemplateCategory]}`}
              </Text>
            </TouchableOpacity>
          )
        )}
      </ScrollView>

      {/* View Mode Toggle */}
      <View style={styles.viewModeContainer}>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'grid' && styles.viewModeButtonActive]}
          onPress={() => setViewMode('grid')}
        >
          <Text style={styles.viewModeIcon}>⊞</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'list' && styles.viewModeButtonActive]}
          onPress={() => setViewMode('list')}
        >
          <Text style={styles.viewModeIcon}>≡</Text>
        </TouchableOpacity>
      </View>

      {/* Templates List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
        </View>
      ) : filteredTemplates.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={filteredTemplates}
          renderItem={renderTemplateCard}
          keyExtractor={item => item.id}
          numColumns={viewMode === 'grid' ? 2 : 1}
          contentContainerStyle={styles.listContent}
          scrollEnabled={false}
        />
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
  createButton: {
    minWidth: 120,
    marginBottom: 0,
  },
  searchContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    fontSize: 14,
    color: '#212121',
  },
  categoryTabs: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  categoryTabsContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
  },
  categoryTab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
  },
  categoryTabActive: {
    backgroundColor: '#1976d2',
  },
  categoryTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  categoryTabTextActive: {
    color: '#fff',
  },
  viewModeContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    gap: 8,
  },
  viewModeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
  },
  viewModeButtonActive: {
    backgroundColor: '#1976d2',
  },
  viewModeIcon: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
  },
  listContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  templateCard: {
    marginBottom: 0,
    marginHorizontal: '1%',
    width: '48%',
  },
  templateCardList: {
    width: '100%',
    marginHorizontal: 0,
  },
  cardContent: {
    paddingVertical: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  templateName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
    flex: 1,
  },
  chartIndicator: {
    fontSize: 14,
  },
  description: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    lineHeight: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  infoRow: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 10,
    color: '#999',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1976d2',
  },
  ratingContainer: {
    marginBottom: 8,
  },
  stars: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f57c00',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  previewButton: {
    flex: 1,
    marginBottom: 0,
    backgroundColor: '#f0f0f0',
  },
  useButton: {
    flex: 1,
    marginBottom: 0,
  },
});
