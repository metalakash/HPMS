/**
 * useReportGeneration Hook
 * Manage report generation lifecycle and scheduling
 */

import { useState, useCallback } from 'react';
import { reportService } from '../services/report.service';
import { ReportRequest, GeneratedReport, ScheduledReport } from '../services/report-api';

interface GenerationState {
  generatedReports: GeneratedReport[];
  selectedReport: GeneratedReport | null;
  generating: boolean;
  generationError: string | null;
  generationProgress: number;
}

interface SchedulingState {
  scheduledReports: ScheduledReport[];
  scheduling: boolean;
  schedulingError: string | null;
}

export const useReportGeneration = () => {
  const [genState, setGenState] = useState<GenerationState>({
    generatedReports: [],
    selectedReport: null,
    generating: false,
    generationError: null,
    generationProgress: 0,
  });

  const generateReport = useCallback(
    async (request: ReportRequest, format: 'pdf' | 'excel' | 'csv' | 'json') => {
      setGenState(prev => ({
        ...prev,
        generating: true,
        generationError: null,
        generationProgress: 0,
      }));

      try {
        const report = await reportService.validateAndGenerateReport(request, format);

        if (report) {
          setGenState(prev => ({
            ...prev,
            generatedReports: [report, ...prev.generatedReports],
            selectedReport: report,
            generating: false,
            generationProgress: 100,
          }));
          return report;
        } else {
          throw new Error('Report generation returned null');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Report generation failed';
        setGenState(prev => ({
          ...prev,
          generating: false,
          generationError: message,
        }));
        return null;
      }
    },
    []
  );

  const loadGeneratedReports = useCallback(async () => {
    try {
      const reports = await reportService.getGeneratedReports();
      setGenState(prev => ({
        ...prev,
        generatedReports: reports,
      }));
    } catch (error) {
      console.error('Error loading generated reports:', error);
    }
  }, []);

  const deleteReport = useCallback(async (reportId: string) => {
    const success = await reportService.deleteReport(reportId);

    if (success) {
      setGenState(prev => ({
        ...prev,
        generatedReports: prev.generatedReports.filter(r => r.id !== reportId),
        selectedReport: prev.selectedReport?.id === reportId ? null : prev.selectedReport,
      }));
    }

    return success;
  }, []);

  const shareReport = useCallback(async (reportId: string, teamMembers: string[]) => {
    return reportService.shareReport(reportId, teamMembers);
  }, []);

  const downloadReport = useCallback(async (reportId: string) => {
    return reportService.downloadReport(reportId);
  }, []);

  return {
    ...genState,
    generateReport,
    loadGeneratedReports,
    deleteReport,
    shareReport,
    downloadReport,
    selectReport: (report: GeneratedReport) =>
      setGenState(prev => ({ ...prev, selectedReport: report })),
  };
};

export const useReportScheduling = () => {
  const [schedState, setSchedState] = useState<SchedulingState>({
    scheduledReports: [],
    scheduling: false,
    schedulingError: null,
  });

  const scheduleReport = useCallback(
    async (
      request: ReportRequest,
      frequency: 'daily' | 'weekly' | 'monthly',
      emailRecipients?: string[]
    ) => {
      setSchedState(prev => ({
        ...prev,
        scheduling: true,
        schedulingError: null,
      }));

      try {
        const schedule = await reportService.scheduleReport(request, frequency, emailRecipients);

        if (schedule) {
          setSchedState(prev => ({
            ...prev,
            scheduledReports: [schedule, ...prev.scheduledReports],
            scheduling: false,
          }));
          return schedule;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Scheduling failed';
        setSchedState(prev => ({
          ...prev,
          scheduling: false,
          schedulingError: message,
        }));
      }

      return null;
    },
    []
  );

  const loadScheduledReports = useCallback(async () => {
    try {
      const schedules = await reportService.getScheduledReports();
      setSchedState(prev => ({
        ...prev,
        scheduledReports: schedules,
      }));
    } catch (error) {
      console.error('Error loading scheduled reports:', error);
    }
  }, []);

  const updateSchedule = useCallback(
    async (scheduleId: string, updates: Partial<ScheduledReport>) => {
      try {
        const updated = await reportService.updateSchedule(scheduleId, updates);

        if (updated) {
          setSchedState(prev => ({
            ...prev,
            scheduledReports: prev.scheduledReports.map(s =>
              s.id === scheduleId ? updated : s
            ),
          }));
          return true;
        }
      } catch (error) {
        console.error('Error updating schedule:', error);
      }

      return false;
    },
    []
  );

  const pauseSchedule = useCallback(async (scheduleId: string) => {
    const success = await reportService.pauseSchedule(scheduleId);

    if (success) {
      setSchedState(prev => ({
        ...prev,
        scheduledReports: prev.scheduledReports.map(s =>
          s.id === scheduleId ? { ...s, isActive: false } : s
        ),
      }));
    }

    return success;
  }, []);

  const resumeSchedule = useCallback(async (scheduleId: string) => {
    const success = await reportService.resumeSchedule(scheduleId);

    if (success) {
      setSchedState(prev => ({
        ...prev,
        scheduledReports: prev.scheduledReports.map(s =>
          s.id === scheduleId ? { ...s, isActive: true } : s
        ),
      }));
    }

    return success;
  }, []);

  const deleteSchedule = useCallback(async (scheduleId: string) => {
    const success = await reportService.deleteSchedule(scheduleId);

    if (success) {
      setSchedState(prev => ({
        ...prev,
        scheduledReports: prev.scheduledReports.filter(s => s.id !== scheduleId),
      }));
    }

    return success;
  }, []);

  return {
    ...schedState,
    scheduleReport,
    loadScheduledReports,
    updateSchedule,
    pauseSchedule,
    resumeSchedule,
    deleteSchedule,
  };
};
