/**
 * Cross-Feature Map Screen
 * Visual map showing relationships between features
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';

interface FeatureNode {
  id: string;
  name: string;
  type: string;
  linkedCount: number;
  color: string;
}

interface FeatureLink {
  id: string;
  from: string;
  to: string;
  count: number;
  strength: 'weak' | 'medium' | 'strong';
}

export const CrossFeatureMapScreen: React.FC = () => {
  const [nodes, setNodes] = useState<FeatureNode[]>([]);
  const [links, setLinks] = useState<FeatureLink[]>([]);
  const [selectedNode, setSelectedNode] = useState<FeatureNode | null>(null);
  const [selectedLink, setSelectedLink] = useState<FeatureLink | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [layoutType, setLayoutType] = useState<'hierarchical' | 'circular'>('hierarchical');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFeatureMap();
  }, []);

  const loadFeatureMap = useCallback(async () => {
    setLoading(true);
    try {
      // Simulate API call
      const mockNodes: FeatureNode[] = [
        {
          id: 'projects',
          name: 'Projects',
          type: 'core',
          linkedCount: 45,
          color: '#2196F3',
        },
        {
          id: 'inspections',
          name: 'Inspections',
          type: 'core',
          linkedCount: 78,
          color: '#FF9800',
        },
        {
          id: 'workorders',
          name: 'Work Orders',
          type: 'core',
          linkedCount: 56,
          color: '#4CAF50',
        },
        {
          id: 'compliance',
          name: 'Compliance',
          type: 'core',
          linkedCount: 34,
          color: '#F44336',
        },
        {
          id: 'reports',
          name: 'Reports',
          type: 'analytics',
          linkedCount: 23,
          color: '#9C27B0',
        },
      ];

      const mockLinks: FeatureLink[] = [
        {
          id: 'link-1',
          from: 'projects',
          to: 'inspections',
          count: 45,
          strength: 'strong',
        },
        {
          id: 'link-2',
          from: 'inspections',
          to: 'workorders',
          count: 78,
          strength: 'strong',
        },
        {
          id: 'link-3',
          from: 'workorders',
          to: 'compliance',
          count: 56,
          strength: 'medium',
        },
        {
          id: 'link-4',
          from: 'compliance',
          to: 'reports',
          count: 34,
          strength: 'weak',
        },
      ];

      setNodes(mockNodes);
      setLinks(mockLinks);
    } catch (error) {
      console.error('Error loading feature map:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const getNodeSize = (linkedCount: number): number => {
    return 40 + (linkedCount / 10) * 20;
  };

  const getStrengthWidth = (strength: string): string => {
    switch (strength) {
      case 'strong':
        return '4px';
      case 'medium':
        return '2px';
      case 'weak':
        return '1px';
      default:
        return '2px';
    }
  };

  const totalLinks = links.reduce((sum, link) => sum + link.count, 0);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="cross-feature-map-screen">
      <ScrollView style={styles.content}>
        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={styles.screenTitle}>Feature Relationship Map</Text>
          <Text style={styles.subtitle}>Inspect → Fix → Comply Workflow</Text>
        </View>

        {/* Feature Graph Visualization */}
        <View style={styles.graphSection}>
          <Text style={styles.sectionLabel}>Feature Network</Text>
          <View style={styles.graphContainer}>
            {/* Simplified graph representation */}
            <View style={styles.nodeRow}>
              {nodes.map(node => (
                <TouchableOpacity
                  key={node.id}
                  style={[
                    styles.node,
                    {
                      width: getNodeSize(node.linkedCount),
                      height: getNodeSize(node.linkedCount),
                      backgroundColor: node.color,
                      borderWidth: selectedNode?.id === node.id ? 3 : 1,
                    },
                  ]}
                  onPress={() => setSelectedNode(node)}
                  testID={`feature-node-${node.id}`}
                >
                  <Text style={styles.nodeText}>{node.name}</Text>
                  <Text style={styles.nodeCount}>{node.linkedCount}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Links visualization */}
            <View style={styles.linksInfo}>
              <Text style={styles.linksTitle}>Connections</Text>
              {links.map(link => (
                <TouchableOpacity
                  key={link.id}
                  style={[
                    styles.linkRow,
                    selectedLink?.id === link.id && styles.linkRowSelected,
                  ]}
                  onPress={() => setSelectedLink(link)}
                  testID={`feature-link-${link.id}`}
                >
                  <View style={styles.linkContent}>
                    <Text style={styles.linkText}>
                      {nodes.find(n => n.id === link.from)?.name} → {nodes.find(n => n.id === link.to)?.name}
                    </Text>
                    <View style={styles.linkStrengthBar}>
                      <View
                        style={[
                          styles.strengthFill,
                          {
                            width: `${(link.count / 100) * 100}%`,
                            borderWidth: parseInt(getStrengthWidth(link.strength)),
                          },
                        ]}
                      />
                    </View>
                  </View>
                  <Text style={styles.linkCount}>{link.count}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Relationship Summary */}
        <View style={styles.summarySection}>
          <Text style={styles.sectionLabel}>Relationship Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Links:</Text>
              <Text style={styles.summaryValue}>{totalLinks}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Features Connected:</Text>
              <Text style={styles.summaryValue}>{nodes.length}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Avg Links Per Feature:</Text>
              <Text style={styles.summaryValue}>
                {(totalLinks / nodes.length).toFixed(1)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Strongest Link:</Text>
              <Text style={styles.summaryValue}>
                Inspections → Work Orders (78)
              </Text>
            </View>
          </View>
        </View>

        {/* Filters */}
        <View style={styles.filterSection}>
          <Text style={styles.sectionLabel}>Filter Relationships</Text>
          <Picker
            selectedValue={filterType}
            style={styles.picker}
            onValueChange={setFilterType}
            testID="relationship-filter"
          >
            <Picker.Item label="All Relationships" value="all" />
            <Picker.Item label="Inspection → Work Order" value="inspection-wo" />
            <Picker.Item label="Work Order → Compliance" value="wo-compliance" />
            <Picker.Item label="Project → All" value="project-all" />
          </Picker>
        </View>

        {/* Layout Selection */}
        <View style={styles.layoutSection}>
          <Text style={styles.sectionLabel}>Graph Layout</Text>
          <View style={styles.layoutButtonRow}>
            <TouchableOpacity
              style={[
                styles.layoutButton,
                layoutType === 'hierarchical' && styles.layoutButtonActive,
              ]}
              onPress={() => setLayoutType('hierarchical')}
              testID="layout-hierarchical"
            >
              <Text
                style={[
                  styles.layoutButtonText,
                  layoutType === 'hierarchical' && styles.layoutButtonTextActive,
                ]}
              >
                Hierarchical
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.layoutButton,
                layoutType === 'circular' && styles.layoutButtonActive,
              ]}
              onPress={() => setLayoutType('circular')}
              testID="layout-circular"
            >
              <Text
                style={[
                  styles.layoutButtonText,
                  layoutType === 'circular' && styles.layoutButtonTextActive,
                ]}
              >
                Circular
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Selected Node Details */}
        {selectedNode && (
          <View style={styles.detailsSection}>
            <Text style={styles.sectionLabel}>
              {selectedNode.name} Details
            </Text>
            <View style={styles.detailsCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Type:</Text>
                <Text style={styles.detailValue}>{selectedNode.type}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Linked Items:</Text>
                <Text style={styles.detailValue}>{selectedNode.linkedCount}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Active Links:</Text>
                <Text style={styles.detailValue}>
                  {links.filter(l => l.from === selectedNode.id || l.to === selectedNode.id).length}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Workflow Templates */}
        <View style={styles.templatesSection}>
          <Text style={styles.sectionLabel}>Workflow Templates</Text>
          <TouchableOpacity style={styles.templateButton} testID="template-standard">
            <Text style={styles.templateButtonText}>
              📋 Standard Defect Workflow
            </Text>
            <Text style={styles.templateDesc}>Inspection → WO → Compliance</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.templateButton} testID="template-emergency">
            <Text style={styles.templateButtonText}>
              🚨 Emergency Response
            </Text>
            <Text style={styles.templateDesc}>Project → Inspection → WO</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.customButton} testID="custom-workflow">
            <Text style={styles.customButtonText}>+ Create Custom Workflow</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 12,
  },
  headerSection: {
    marginBottom: 20,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  graphSection: {
    marginBottom: 16,
  },
  graphContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
  },
  nodeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 8,
  },
  node: {
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.8,
  },
  nodeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  nodeCount: {
    color: '#fff',
    fontSize: 10,
    marginTop: 2,
  },
  linksInfo: {},
  linksTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 6,
    backgroundColor: '#f9f9f9',
  },
  linkRowSelected: {
    backgroundColor: '#e3f2fd',
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  linkContent: {
    flex: 1,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  linkStrengthBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  strengthFill: {
    backgroundColor: '#2196F3',
  },
  linkCount: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2196F3',
    marginLeft: 8,
  },
  summarySection: {
    marginBottom: 16,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 12,
    color: '#333',
    fontWeight: 'bold',
  },
  filterSection: {
    marginBottom: 16,
  },
  picker: {
    height: 40,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  layoutSection: {
    marginBottom: 16,
  },
  layoutButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  layoutButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  layoutButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  layoutButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  layoutButtonTextActive: {
    color: '#fff',
  },
  detailsSection: {
    marginBottom: 16,
  },
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 12,
    color: '#333',
  },
  templatesSection: {
    marginBottom: 16,
  },
  templateButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  templateButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  templateDesc: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  customButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  customButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
