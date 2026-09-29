/**
 * useExport Hook
 * Manage export operations and progress
 */

import { useState, useCallback } from 'react';
import { exportAPI, ExportJob } from '../services/export-api';
import { exportService } from '../services/export.service';

interface ExportState {
  exports: ExportJob[];
  selectedExport: ExportJob | null;
  exporting: boolean;
  currentJobId: string | null;
  progress: number;
  error: string | null;
}

export const useExport = () => {
  const [state, setState] = useState<ExportState>({
    exports: [],
    selectedExport: null,
    exporting: false,
    currentJobId: null,
    progress: 0,
    error: null,
  });

  const exportData = useCallback(async (features: string[], format: 'csv' | 'json' | 'excel' | 'pdf') => {
    setState(prev => ({ ...prev, exporting: true, error: null, progress: 0 }));

    try {
      const job = await exportAPI.createExport(features, format);
      setState(prev => ({
        ...prev,
        currentJobId: job.id,
        selectedExport: job,
        exports: [job, ...prev.exports],
      }));

      // Poll for progress
      const pollInterval = setInterval(async () => {
        try {
          const status = await exportAPI.getExportStatus(job.id);
          setState(prev => ({ ...prev, progress: status.progress }));

          if (status.progress === 100) {
            clearInterval(pollInterval);
            setState(prev => ({ ...prev, exporting: false }));
          }
        } catch (err) {
          console.error('Error polling export status:', err);
        }
      }, 1000);

      return job;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed';
      setState(prev => ({ ...prev, exporting: false, error: message }));
      return null;
    }
  }, []);

  const getExportStatus = useCallback(async (jobId: string) => {
    try {
      return await exportAPI.getExportStatus(jobId);
    } catch (error) {
      console.error('Error getting export status:', error);
      return null;
    }
  }, []);

  const downloadExport = useCallback(async (exportId: string) => {
    try {
      return await exportAPI.downloadExport(exportId);
    } catch (error) {
      console.error('Error downloading export:', error);
      return null;
    }
  }, []);

  const deleteExport = useCallback(async (exportId: string) => {
    try {
      await exportAPI.deleteExport(exportId);
      setState(prev => ({
        ...prev,
        exports: prev.exports.filter(e => e.id !== exportId),
        selectedExport: prev.selectedExport?.id === exportId ? null : prev.selectedExport,
      }));
      return true;
    } catch (error) {
      console.error('Error deleting export:', error);
      return false;
    }
  }, []);

  const shareExport = useCallback(async (exportId: string, recipients: string[]) => {
    try {
      await exportAPI.shareExport(exportId, recipients);
      return true;
    } catch (error) {
      console.error('Error sharing export:', error);
      return false;
    }
  }, []);

  const pauseExport = useCallback(async (jobId: string) => {
    try {
      await exportAPI.pauseExport(jobId);
      return true;
    } catch (error) {
      console.error('Error pausing export:', error);
      return false;
    }
  }, []);

  const resumeExport = useCallback(async (jobId: string) => {
    try {
      await exportAPI.resumeExport(jobId);
      return true;
    } catch (error) {
      console.error('Error resuming export:', error);
      return false;
    }
  }, []);

  const cancelExport = useCallback(async (jobId: string) => {
    try {
      await exportAPI.cancelExport(jobId);
      setState(prev => ({ ...prev, exporting: false }));
      return true;
    } catch (error) {
      console.error('Error canceling export:', error);
      return false;
    }
  }, []);

  const loadExports = useCallback(async () => {
    try {
      const exports = await exportAPI.listExports();
      setState(prev => ({ ...prev, exports }));
    } catch (error) {
      console.error('Error loading exports:', error);
    }
  }, []);

  const estimateSize = useCallback((features: string[], format: 'csv' | 'json' | 'excel' | 'pdf') => {
    // Simplified estimation: 500 bytes per record
    const recordCounts: Record<string, number> = {
      projects: 45,
      inspections: 128,
      workorders: 67,
      compliance: 34,
      reports: 12,
    };

    const totalRecords = features.reduce((sum, f) => sum + (recordCounts[f] || 0), 0);
    const sizeMultipliers: Record<string, number> = {
      csv: 0.5,
      json: 0.8,
      excel: 1.2,
      pdf: 2.0,
    };

    return totalRecords * 500 * sizeMultipliers[format];
  }, []);

  return {
    ...state,
    exportData,
    getExportStatus,
    downloadExport,
    deleteExport,
    shareExport,
    pauseExport,
    resumeExport,
    cancelExport,
    loadExports,
    estimateSize,
  };
};
