/**
 * useCovenants - Custom hooks for covenant compliance monitoring
 */

import { useState, useEffect } from 'react';
import { covenantService } from '@/services/covenant.service';
import { covenantAggregationService } from '@/services/covenant-aggregation.service';

interface UseCovenantState {
  loading: boolean;
  error: string | null;
  data: any;
}

export const useCovenants = (projectId?: string, filters?: any) => {
  const [state, setState] = useState<UseCovenantState>({
    loading: true,
    error: null,
    data: null,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        const covenants = await covenantService.getCovenants(projectId, filters);
        const summary = covenantAggregationService.calculateSummary(covenants);
        const score = covenantAggregationService.calculateComplianceScore(covenants);

        setState({
          loading: false,
          error: null,
          data: { covenants, summary, score },
        });
      } catch (error: any) {
        setState({
          loading: false,
          error: error.message || 'Failed to fetch covenants',
          data: null,
        });
      }
    };

    fetchData();
  }, [projectId, JSON.stringify(filters || {})]);

  return state;
};

export const useCovenant = (covenantId: string) => {
  const [state, setState] = useState<UseCovenantState>({
    loading: true,
    error: null,
    data: null,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        const covenant = await covenantService.getCovenant(covenantId);
        const records = await covenantService.getCovenantRecords(covenantId);
        const trend = covenantAggregationService.calculateTrend(records);

        setState({
          loading: false,
          error: null,
          data: { covenant, records, trend },
        });
      } catch (error: any) {
        setState({
          loading: false,
          error: error.message || 'Failed to fetch covenant',
          data: null,
        });
      }
    };

    if (covenantId) {
      fetchData();
    }
  }, [covenantId]);

  return state;
};

export const useCovenantRecords = (covenantId: string, startDate?: string, endDate?: string) => {
  const [state, setState] = useState<UseCovenantState>({
    loading: true,
    error: null,
    data: null,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        const records = await covenantService.getCovenantRecords(
          covenantId,
          startDate,
          endDate
        );

        setState({
          loading: false,
          error: null,
          data: records,
        });
      } catch (error: any) {
        setState({
          loading: false,
          error: error.message || 'Failed to fetch records',
          data: null,
        });
      }
    };

    if (covenantId) {
      fetchData();
    }
  }, [covenantId, startDate, endDate]);

  return state;
};

export const useBreaches = (projectId?: string, status?: string) => {
  const [state, setState] = useState<UseCovenantState>({
    loading: true,
    error: null,
    data: null,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        const breaches = await covenantService.getBreaches(projectId, status);
        const summary = {
          total: breaches.length,
          active: breaches.filter((b: any) => b.status === 'active').length,
          cured: breaches.filter((b: any) => b.status === 'cured').length,
          waived: breaches.filter((b: any) => b.status === 'waived').length,
        };

        setState({
          loading: false,
          error: null,
          data: { breaches, summary },
        });
      } catch (error: any) {
        setState({
          loading: false,
          error: error.message || 'Failed to fetch breaches',
          data: null,
        });
      }
    };

    fetchData();
  }, [projectId, status]);

  return state;
};

export const useBreach = (breachId: string) => {
  const [state, setState] = useState<UseCovenantState>({
    loading: true,
    error: null,
    data: null,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        const breach = await covenantService.getBreach(breachId);
        setState({
          loading: false,
          error: null,
          data: breach,
        });
      } catch (error: any) {
        setState({
          loading: false,
          error: error.message || 'Failed to fetch breach',
          data: null,
        });
      }
    };

    if (breachId) {
      fetchData();
    }
  }, [breachId]);

  return state;
};

export const useComplianceScore = (projectId?: string) => {
  const [state, setState] = useState<UseCovenantState>({
    loading: true,
    error: null,
    data: null,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        const score = await covenantService.getComplianceScore(projectId);
        setState({
          loading: false,
          error: null,
          data: score,
        });
      } catch (error: any) {
        setState({
          loading: false,
          error: error.message || 'Failed to fetch compliance score',
          data: null,
        });
      }
    };

    fetchData();
  }, [projectId]);

  return state;
};

export const useCovenantForecast = (covenantId: string, months: number = 6) => {
  const [state, setState] = useState<UseCovenantState>({
    loading: true,
    error: null,
    data: null,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        const forecast = await covenantService.getForecast(covenantId, months);
        setState({
          loading: false,
          error: null,
          data: forecast,
        });
      } catch (error: any) {
        setState({
          loading: false,
          error: error.message || 'Failed to fetch forecast',
          data: null,
        });
      }
    };

    if (covenantId) {
      fetchData();
    }
  }, [covenantId, months]);

  return state;
};

export const useRecordCovenantValue = () => {
  const [state, setState] = useState<UseCovenantState>({
    loading: false,
    error: null,
    data: null,
  });

  const recordValue = async (covenantId: string, value: number, notes?: string) => {
    try {
      setState({ loading: true, error: null, data: null });
      const result = await covenantService.recordCovenantValue(covenantId, value, notes);
      setState({ loading: false, error: null, data: result });
      return result;
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to record value';
      setState({
        loading: false,
        error: errorMsg,
        data: null,
      });
      throw error;
    }
  };

  return { ...state, recordValue };
};

export const useAddBreachAction = () => {
  const [state, setState] = useState<UseCovenantState>({
    loading: false,
    error: null,
    data: null,
  });

  const addAction = async (breachId: string, actionData: any) => {
    try {
      setState({ loading: true, error: null, data: null });
      const result = await covenantService.addBreachAction(breachId, actionData);
      setState({ loading: false, error: null, data: result });
      return result;
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to add action';
      setState({
        loading: false,
        error: errorMsg,
        data: null,
      });
      throw error;
    }
  };

  return { ...state, addAction };
};

export const useGenerateComplianceReport = () => {
  const [state, setState] = useState<UseCovenantState>({
    loading: false,
    error: null,
    data: null,
  });

  const generateReport = async (
    templateType: string,
    startDate: string,
    endDate: string,
    format: 'pdf' | 'excel' | 'csv' = 'pdf'
  ) => {
    try {
      setState({ loading: true, error: null, data: null });
      const result = await covenantService.generateReport(
        templateType,
        startDate,
        endDate,
        format
      );
      setState({ loading: false, error: null, data: result });
      return result;
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
