/**
 * useAnalytics - Custom hook for analytics data fetching and management
 */

import { useState, useEffect } from 'react';
import { analyticsService } from '@/services/analytics.service';
import { analyticsAggregationService } from '@/services/analytics-aggregation.service';

interface UseAnalyticsState {
  loading: boolean;
  error: string | null;
  data: any;
}

export const usePortfolioAnalytics = (period: '7d' | '30d' | '90d' | 'year' = '30d') => {
  const [state, setState] = useState<UseAnalyticsState>({
    loading: true,
    error: null,
    data: null,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        const data = await analyticsService.getPortfolioAnalytics(period);
        setState({ loading: false, error: null, data });
      } catch (error: any) {
        setState({
          loading: false,
          error: error.message || 'Failed to fetch portfolio analytics',
          data: null,
        });
      }
    };

    fetchData();
  }, [period]);

  return state;
};

export const useProductionMetrics = (startDate: string, endDate: string) => {
  const [state, setState] = useState<UseAnalyticsState>({
    loading: true,
    error: null,
    data: null,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        const data = await analyticsService.getProductionMetrics(startDate, endDate);
        const kpi = analyticsAggregationService.calculateKPI(data);
        setState({ loading: false, error: null, data: { raw: data, kpi } });
      } catch (error: any) {
        setState({
          loading: false,
          error: error.message || 'Failed to fetch production metrics',
          data: null,
        });
      }
    };

    if (startDate && endDate) {
      fetchData();
    }
  }, [startDate, endDate]);

  return state;
};

export const useEfficiencyMetrics = (startDate: string, endDate: string) => {
  const [state, setState] = useState<UseAnalyticsState>({
    loading: true,
    error: null,
    data: null,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        const data = await analyticsService.getEfficiencyMetrics(startDate, endDate);
        const kpi = analyticsAggregationService.calculateKPI(data);
        const anomalies = analyticsAggregationService.detectAnomalies(
          data.map((d: any) => d.value)
        );
        setState({ loading: false, error: null, data: { raw: data, kpi, anomalies } });
      } catch (error: any) {
        setState({
          loading: false,
          error: error.message || 'Failed to fetch efficiency metrics',
          data: null,
        });
      }
    };

    if (startDate && endDate) {
      fetchData();
    }
  }, [startDate, endDate]);

  return state;
};

export const useCostAnalytics = (startDate: string, endDate: string) => {
  const [state, setState] = useState<UseAnalyticsState>({
    loading: true,
    error: null,
    data: null,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        const data = await analyticsService.getCostAnalytics(startDate, endDate);
        const kpi = analyticsAggregationService.calculateKPI(data);
        setState({ loading: false, error: null, data: { raw: data, kpi } });
      } catch (error: any) {
        setState({
          loading: false,
          error: error.message || 'Failed to fetch cost analytics',
          data: null,
        });
      }
    };

    if (startDate && endDate) {
      fetchData();
    }
  }, [startDate, endDate]);

  return state;
};

export const useForecastData = (
  metricType: 'production' | 'efficiency' | 'cost' = 'production',
  months: number = 6
) => {
  const [state, setState] = useState<UseAnalyticsState>({
    loading: true,
    error: null,
    data: null,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        const data = await analyticsService.getForecastData(metricType, months);
        setState({ loading: false, error: null, data });
      } catch (error: any) {
        setState({
          loading: false,
          error: error.message || 'Failed to fetch forecast data',
          data: null,
        });
      }
    };

    fetchData();
  }, [metricType, months]);

  return state;
};

export const useAnomalyAlerts = (projectId?: string) => {
  const [state, setState] = useState<UseAnalyticsState>({
    loading: true,
    error: null,
    data: null,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        const data = await analyticsService.getAnomalyAlerts(projectId);
        setState({ loading: false, error: null, data });
      } catch (error: any) {
        setState({
          loading: false,
          error: error.message || 'Failed to fetch anomaly alerts',
          data: null,
        });
      }
    };

    fetchData();
  }, [projectId]);

  return state;
};

export const useReports = (limit: number = 20, offset: number = 0) => {
  const [state, setState] = useState<UseAnalyticsState>({
    loading: true,
    error: null,
    data: null,
  });

  const refetch = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const data = await analyticsService.getReports(limit, offset);
      setState({ loading: false, error: null, data });
    } catch (error: any) {
      setState({
        loading: false,
        error: error.message || 'Failed to fetch reports',
        data: null,
      });
    }
  };

  useEffect(() => {
    refetch();
  }, [limit, offset]);

  return { ...state, refetch };
};

export const useGenerateReport = () => {
  const [state, setState] = useState<UseAnalyticsState>({
    loading: false,
    error: null,
    data: null,
  });

  const generateReport = async (
    templateType: string,
    format: 'pdf' | 'csv' | 'excel' | 'json',
    startDate: string,
    endDate: string
  ) => {
    try {
      setState({ loading: true, error: null, data: null });
      const data = await analyticsService.generateReport(
        templateType,
        format,
        startDate,
        endDate
      );
      setState({ loading: false, error: null, data });
      return data;
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to generate report';
      setState({
        loading: false,
        error: errorMsg,
        data: null,
      });
      throw error;
    }
  };

  return { ...state, generateReport };
};

export const useExportReport = () => {
  const [state, setState] = useState<UseAnalyticsState>({
    loading: false,
    error: null,
    data: null,
  });

  const exportReport = async (reportId: string, format: 'pdf' | 'csv' | 'excel' | 'json') => {
    try {
      setState({ loading: true, error: null, data: null });
      const data = await analyticsService.exportReport(reportId, format);
      setState({ loading: false, error: null, data });
      return data;
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to export report';
      setState({
        loading: false,
        error: errorMsg,
        data: null,
      });
      throw error;
    }
  };

  return { ...state, exportReport };
};
