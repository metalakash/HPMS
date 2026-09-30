/**
 * useCrossFeature Hook
 * State management for cross-feature integration
 */

import { useState, useCallback } from 'react';

interface FeatureNode {
  id: string;
  name: string;
  linkedCount: number;
}

interface FeatureLink {
  id: string;
  from: string;
  to: string;
  count: number;
  strength: 'weak' | 'medium' | 'strong';
}

interface CrossFeatureState {
  nodes: FeatureNode[];
  edges: FeatureLink[];
  selectedNode: FeatureNode | null;
  selectedEdge: FeatureLink | null;
  filterType: string;
  layoutType: 'hierarchical' | 'circular';
  loading: boolean;
  error: string | null;
}

const initialState: CrossFeatureState = {
  nodes: [],
  edges: [],
  selectedNode: null,
  selectedEdge: null,
  filterType: 'all',
  layoutType: 'hierarchical',
  loading: false,
  error: null,
};

export const useCrossFeature = () => {
  const [state, setState] = useState<CrossFeatureState>(initialState);

  const loadFeatureMap = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      // API call would happen here
      const mockNodes: FeatureNode[] = [
        { id: 'projects', name: 'Projects', linkedCount: 45 },
        { id: 'inspections', name: 'Inspections', linkedCount: 78 },
        { id: 'workorders', name: 'Work Orders', linkedCount: 56 },
        { id: 'compliance', name: 'Compliance', linkedCount: 34 },
        { id: 'reports', name: 'Reports', linkedCount: 23 },
      ];

      const mockEdges: FeatureLink[] = [
        { id: 'link-1', from: 'projects', to: 'inspections', count: 45, strength: 'strong' },
        { id: 'link-2', from: 'inspections', to: 'workorders', count: 78, strength: 'strong' },
        { id: 'link-3', from: 'workorders', to: 'compliance', count: 56, strength: 'medium' },
        { id: 'link-4', from: 'compliance', to: 'reports', count: 34, strength: 'weak' },
      ];

      setState(prev => ({
        ...prev,
        nodes: mockNodes,
        edges: mockEdges,
        loading: false,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load feature map';
      setState(prev => ({ ...prev, error: message, loading: false }));
    }
  }, []);

  const selectNode = useCallback((nodeId: string) => {
    setState(prev => {
      const node = prev.nodes.find(n => n.id === nodeId) || null;
      return { ...prev, selectedNode: node };
    });
  }, []);

  const selectEdge = useCallback((edgeId: string) => {
    setState(prev => {
      const edge = prev.edges.find(e => e.id === edgeId) || null;
      return { ...prev, selectedEdge: edge };
    });
  }, []);

  const applyFilter = useCallback((filterType: string) => {
    setState(prev => ({ ...prev, filterType }));
  }, []);

  const changeLayout = useCallback((layoutType: 'hierarchical' | 'circular') => {
    setState(prev => ({ ...prev, layoutType }));
  }, []);

  const createLink = useCallback(async (fromId: string, toId: string, strength: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      // API call would happen here
      await new Promise(resolve => setTimeout(resolve, 500));
      setState(prev => ({ ...prev, loading: false }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create link';
      setState(prev => ({ ...prev, error: message, loading: false }));
    }
  }, []);

  const removeLink = useCallback(async (linkId: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      // API call would happen here
      await new Promise(resolve => setTimeout(resolve, 500));
      setState(prev => ({
        ...prev,
        edges: prev.edges.filter(e => e.id !== linkId),
        loading: false,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove link';
      setState(prev => ({ ...prev, error: message, loading: false }));
    }
  }, []);

  const updateLinkStrength = useCallback(async (linkId: string, strength: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      // API call would happen here
      await new Promise(resolve => setTimeout(resolve, 500));
      setState(prev => ({
        ...prev,
        edges: prev.edges.map(e => (e.id === linkId ? { ...e, strength: strength as any } : e)),
        loading: false,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update link';
      setState(prev => ({ ...prev, error: message, loading: false }));
    }
  }, []);

  const identifyBlockingIssues = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      // API call would happen here
      await new Promise(resolve => setTimeout(resolve, 800));
      setState(prev => ({ ...prev, loading: false }));
    } catch (err) {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const calculateHealthScore = useCallback(async () => {
    try {
      // API call would happen here
      return {
        overall: 72,
        onTime: 85,
        blocked: 8,
        overdue: 7,
      };
    } catch (err) {
      console.error('Failed to calculate health score:', err);
      return null;
    }
  }, []);

  const getCriticalPath = useCallback(async () => {
    try {
      // API call would happen here
      return ['inspection-1', 'workorder-1', 'compliance-1'];
    } catch (err) {
      console.error('Failed to get critical path:', err);
      return [];
    }
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const resetState = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    // State
    nodes: state.nodes,
    edges: state.edges,
    selectedNode: state.selectedNode,
    selectedEdge: state.selectedEdge,
    filterType: state.filterType,
    layoutType: state.layoutType,
    loading: state.loading,
    error: state.error,

    // Methods
    loadFeatureMap,
    selectNode,
    selectEdge,
    applyFilter,
    changeLayout,
    createLink,
    removeLink,
    updateLinkStrength,
    identifyBlockingIssues,
    calculateHealthScore,
    getCriticalPath,
    clearError,
    resetState,
  };
};
