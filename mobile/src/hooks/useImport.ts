/**
 * useImport Hook
 * Manage import operations and conflict resolution
 */

import { useState, useCallback } from 'react';
import { importAPI, ImportJob, ImportConflict, ConflictStrategy } from '../services/import-api';
import { importService } from '../services/import.service';

interface ImportState {
  imports: ImportJob[];
  selectedImport: ImportJob | null;
  importing: boolean;
  currentJobId: string | null;
  progress: number;
  conflicts: ImportConflict[];
  error: string | null;
}

export const useImport = () => {
  const [state, setState] = useState<ImportState>({
    imports: [],
    selectedImport: null,
    importing: false,
    currentJobId: null,
    progress: 0,
    conflicts: [],
    error: null,
  });

  const uploadFile = useCallback(
    async (file: File, feature: string, strategy: ConflictStrategy) => {
      setState(prev => ({ ...prev, importing: true, error: null, progress: 0 }));

      try {
        const job = await importAPI.uploadFile(file, feature, strategy);
        setState(prev => ({
          ...prev,
          currentJobId: job.id,
          selectedImport: job,
          imports: [job, ...prev.imports],
        }));

        // Poll for progress
        const pollInterval = setInterval(async () => {
          try {
            const status = await importAPI.getImportStatus(job.id);
            setState(prev => ({ ...prev, progress: status.progress }));

            if (status.progress === 100) {
              clearInterval(pollInterval);
              setState(prev => ({ ...prev, importing: false }));
              await loadConflicts(job.id);
            }
          } catch (err) {
            console.error('Error polling import status:', err);
          }
        }, 1000);

        return job;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Upload failed';
        setState(prev => ({ ...prev, importing: false, error: message }));
        return null;
      }
    },
    []
  );

  const loadConflicts = useCallback(async (importId: string) => {
    try {
      const conflicts = await importAPI.getConflicts(importId);
      setState(prev => ({ ...prev, conflicts }));
      return conflicts;
    } catch (error) {
      console.error('Error loading conflicts:', error);
      return [];
    }
  }, []);

  const resolveConflicts = useCallback(
    async (importId: string, strategy: ConflictStrategy) => {
      try {
        await importAPI.resolveConflicts(importId, strategy);
        setState(prev => ({ ...prev, conflicts: [] }));
        return true;
      } catch (error) {
        console.error('Error resolving conflicts:', error);
        return false;
      }
    },
    []
  );

  const resolveConflict = useCallback(
    async (importId: string, conflictId: string, resolution: 'keep' | 'replace', value?: any) => {
      try {
        await importAPI.resolveConflict(importId, conflictId, resolution, value);
        setState(prev => ({
          ...prev,
          conflicts: prev.conflicts.filter(c => c.recordId !== conflictId),
        }));
        return true;
      } catch (error) {
        console.error('Error resolving conflict:', error);
        return false;
      }
    },
    []
  );

  const getImportStatus = useCallback(async (jobId: string) => {
    try {
      return await importAPI.getImportStatus(jobId);
    } catch (error) {
      console.error('Error getting import status:', error);
      return null;
    }
  }, []);

  const cancelImport = useCallback(async (jobId: string) => {
    try {
      await importAPI.cancelImport(jobId);
      setState(prev => ({ ...prev, importing: false }));
      return true;
    } catch (error) {
      console.error('Error canceling import:', error);
      return false;
    }
  }, []);

  const pauseImport = useCallback(async (jobId: string) => {
    try {
      await importAPI.pauseImport(jobId);
      return true;
    } catch (error) {
      console.error('Error pausing import:', error);
      return false;
    }
  }, []);

  const resumeImport = useCallback(async (jobId: string) => {
    try {
      await importAPI.resumeImport(jobId);
      return true;
    } catch (error) {
      console.error('Error resuming import:', error);
      return false;
    }
  }, []);

  const loadImports = useCallback(async () => {
    try {
      const imports = await importAPI.listImports();
      setState(prev => ({ ...prev, imports }));
    } catch (error) {
      console.error('Error loading imports:', error);
    }
  }, []);

  const validateFile = useCallback(async (file: File, feature?: string) => {
    try {
      return await importAPI.validateFile(file, feature);
    } catch (error) {
      console.error('Error validating file:', error);
      return { valid: false, error: 'Validation failed' };
    }
  }, []);

  const previewFile = useCallback(async (file: File) => {
    try {
      return await importAPI.previewFile(file);
    } catch (error) {
      console.error('Error previewing file:', error);
      return [];
    }
  }, []);

  const detectFeatureType = useCallback((data: any[]) => {
    return importService.detectFeatureType(data);
  }, []);

  return {
    ...state,
    uploadFile,
    getImportStatus,
    loadConflicts,
    resolveConflicts,
    resolveConflict,
    cancelImport,
    pauseImport,
    resumeImport,
    loadImports,
    validateFile,
    previewFile,
    detectFeatureType,
  };
};
