/**
 * useReportTemplates Hook
 * Manage report templates with filtering and rating
 */

import { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { reportService } from '../services/report.service';
import { reportAPI, ReportTemplate } from '../services/report-api';

interface UseReportTemplatesState {
  templates: ReportTemplate[];
  filteredTemplates: ReportTemplate[];
  loading: boolean;
  error: string | null;
  selectedCategory: string | null;
  categories: string[];
}

export const useReportTemplates = () => {
  const [state, setState] = useState<UseReportTemplatesState>({
    templates: [],
    filteredTemplates: [],
    loading: false,
    error: null,
    selectedCategory: null,
    categories: ['All', 'Financial', 'Operational', 'Compliance', 'Analytics'],
  });

  const loadTemplates = useCallback(async (category?: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const templates = await reportService.getReportTemplates(category);
      const filtered = category && category !== 'All' ? templates : templates;

      setState(prev => ({
        ...prev,
        templates,
        filteredTemplates: filtered,
        loading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load templates',
      }));
    }
  }, []);

  const filterByCategory = useCallback((category: string | null) => {
    setState(prev => {
      const filtered =
        category && category !== 'All'
          ? prev.templates.filter(t => t.category === category)
          : prev.templates;

      return {
        ...prev,
        selectedCategory: category,
        filteredTemplates: filtered,
      };
    });
  }, []);

  const rateTemplate = useCallback(async (templateId: string, rating: number) => {
    try {
      await reportAPI.rateTemplate(templateId, rating);

      setState(prev => ({
        ...prev,
        templates: prev.templates.map(t =>
          t.id === templateId ? { ...t, rating } : t
        ),
        filteredTemplates: prev.filteredTemplates.map(t =>
          t.id === templateId ? { ...t, rating } : t
        ),
      }));
    } catch (error) {
      console.error('Error rating template:', error);
    }
  }, []);

  const getTemplate = useCallback((templateId: string): ReportTemplate | null => {
    return state.templates.find(t => t.id === templateId) || null;
  }, [state.templates]);

  const refreshTemplates = useCallback(() => {
    loadTemplates(state.selectedCategory || undefined);
  }, [state.selectedCategory, loadTemplates]);

  useFocusEffect(
    useCallback(() => {
      loadTemplates();
    }, [loadTemplates])
  );

  return {
    ...state,
    loadTemplates,
    filterByCategory,
    rateTemplate,
    getTemplate,
    refreshTemplates,
  };
};

export const useReportBuilder = () => {
  const [config, setConfig] = useState<any>({
    name: '',
    feature: '',
    fields: [],
    dateRange: null,
    filters: [],
    groupBy: null,
    sortBy: null,
    includeStats: true,
    chartType: 'bar',
  });

  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateConfig = useCallback((updates: Partial<typeof config>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const generatePreview = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const previewData = await reportService.previewReport(config);
      setPreview(previewData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate preview');
    } finally {
      setLoading(false);
    }
  }, [config]);

  const resetConfig = useCallback(() => {
    setConfig({
      name: '',
      feature: '',
      fields: [],
      dateRange: null,
      filters: [],
      groupBy: null,
      sortBy: null,
      includeStats: true,
      chartType: 'bar',
    });
    setPreview(null);
  }, []);

  const getAvailableFields = useCallback((feature: string): string[] => {
    const fieldMap: Record<string, string[]> = {
      projects: ['id', 'name', 'status', 'progress', 'budget', 'startDate', 'endDate'],
      inspections: ['id', 'type', 'date', 'status', 'findings', 'location', 'inspector'],
      maintenance: ['id', 'type', 'priority', 'status', 'costEstimate', 'scheduledDate'],
      compliance: ['id', 'requirement', 'status', 'dueDate', 'owner', 'evidence'],
    };
    return fieldMap[feature] || [];
  }, []);

  return {
    config,
    preview,
    loading,
    error,
    updateConfig,
    generatePreview,
    resetConfig,
    getAvailableFields,
  };
};

export const useReportExport = () => {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const exportReport = useCallback(
    async (reportId: string, format: 'pdf' | 'excel' | 'csv' | 'json') => {
      setExporting(true);
      setExportError(null);

      try {
        const url = await reportService.exportReport(reportId, format);
        return url;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Export failed';
        setExportError(message);
        return null;
      } finally {
        setExporting(false);
      }
    },
    []
  );

  return { exportReport, exporting, exportError };
};
