/**
 * useProject Hook
 * Project management state and operations
 */

import { useState, useCallback } from 'react';
import { projectAPI, ProjectResponse, DashboardData } from '../services/project-api';
import { dashboardAPI } from '../services/dashboard-api';

interface Project {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  owner_email: string;
  status: 'active' | 'archived' | 'draft';
  members: any[];
  created_at: string;
  updated_at: string;
}

interface ProjectStats {
  project_id: string;
  project_name: string;
  records: number;
  inspections: number;
  work_orders: number;
  compliance_issues: number;
  linked_features: number;
  team_size: number;
}

interface ProjectHealth {
  project_id: string;
  health: number;
  status: string;
  last_updated: string;
}

interface Report {
  id: string;
  name: string;
  type: 'activity' | 'compliance' | 'performance' | 'team';
  generated: string;
  project_count: number;
  format: string;
}

interface ProjectState {
  currentProject: Project | null;
  projects: Project[];
  sharedProjects: Project[];
  selectedProjects: Project[];
  dashboardData: DashboardData | null;
  reports: Report[];
  loading: boolean;
  error: string | null;
}

const initialState: ProjectState = {
  currentProject: null,
  projects: [],
  sharedProjects: [],
  selectedProjects: [],
  dashboardData: null,
  reports: [],
  loading: false,
  error: null,
};

export const useProject = () => {
  const [state, setState] = useState<ProjectState>(initialState);

  const switchProject = useCallback(async (projectId: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const project = await projectAPI.switchProject(projectId);
      setState(prev => ({
        ...prev,
        currentProject: project,
        loading: false,
      }));
      return project;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to switch project';
      setState(prev => ({ ...prev, error: message, loading: false }));
      throw err;
    }
  }, []);

  const createProject = useCallback(
    async (name: string, description: string) => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        const project = await projectAPI.createProject(name, description);
        setState(prev => ({
          ...prev,
          projects: [...prev.projects, project],
          loading: false,
        }));
        return project;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create project';
        setState(prev => ({ ...prev, error: message, loading: false }));
        throw err;
      }
    },
    []
  );

  const loadProjects = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const projects = await projectAPI.listProjects();
      setState(prev => ({
        ...prev,
        projects,
        loading: false,
      }));
      return projects;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load projects';
      setState(prev => ({ ...prev, error: message, loading: false }));
      throw err;
    }
  }, []);

  const loadSharedProjects = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const sharedProjects = await projectAPI.listSharedProjects();
      setState(prev => ({
        ...prev,
        sharedProjects,
        loading: false,
      }));
      return sharedProjects;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load shared projects';
      setState(prev => ({ ...prev, error: message, loading: false }));
      throw err;
    }
  }, []);

  const getProjectDetails = useCallback(async (projectId: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const project = await projectAPI.getProject(projectId);
      setState(prev => ({
        ...prev,
        loading: false,
      }));
      return project;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load project';
      setState(prev => ({ ...prev, error: message, loading: false }));
      throw err;
    }
  }, []);

  const addProjectMember = useCallback(
    async (projectId: string, email: string, role: string) => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        const member = await projectAPI.addMember(projectId, email, role);
        setState(prev => ({
          ...prev,
          loading: false,
        }));
        return member;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to add member';
        setState(prev => ({ ...prev, error: message, loading: false }));
        throw err;
      }
    },
    []
  );

  const removeProjectMember = useCallback(
    async (projectId: string, userId: string) => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        await projectAPI.removeMember(projectId, userId);
        setState(prev => ({
          ...prev,
          loading: false,
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to remove member';
        setState(prev => ({ ...prev, error: message, loading: false }));
        throw err;
      }
    },
    []
  );

  const updateProjectSettings = useCallback(
    async (projectId: string, updates: any) => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        const project = await projectAPI.updateProject(projectId, updates);
        setState(prev => ({
          ...prev,
          currentProject: project,
          loading: false,
        }));
        return project;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update project';
        setState(prev => ({ ...prev, error: message, loading: false }));
        throw err;
      }
    },
    []
  );

  const archiveProject = useCallback(async (projectId: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      await projectAPI.archiveProject(projectId);
      setState(prev => ({
        ...prev,
        loading: false,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to archive project';
      setState(prev => ({ ...prev, error: message, loading: false }));
      throw err;
    }
  }, []);

  const selectProjects = useCallback(async (projectIds: string[]) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const selected = state.projects.filter(p => projectIds.includes(p.id));
      setState(prev => ({
        ...prev,
        selectedProjects: selected,
        loading: false,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to select projects';
      setState(prev => ({ ...prev, error: message, loading: false }));
    }
  }, [state.projects]);

  const generateDashboard = useCallback(
    async (projectIds: string[], dateRange?: any) => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        const data = await dashboardAPI.generateDashboard(projectIds, dateRange);
        setState(prev => ({
          ...prev,
          dashboardData: data,
          loading: false,
        }));
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate dashboard';
        setState(prev => ({ ...prev, error: message, loading: false }));
        throw err;
      }
    },
    []
  );

  const generateReport = useCallback(
    async (
      reportType: 'activity' | 'compliance' | 'performance' | 'team',
      projectIds: string[],
      dateRange?: any
    ) => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        const report = await dashboardAPI.generateReport(reportType, projectIds, dateRange);
        setState(prev => ({
          ...prev,
          reports: [...prev.reports, report],
          loading: false,
        }));
        return report;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate report';
        setState(prev => ({ ...prev, error: message, loading: false }));
        throw err;
      }
    },
    []
  );

  const loadReports = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const reports = await dashboardAPI.listReports();
      setState(prev => ({
        ...prev,
        reports,
        loading: false,
      }));
      return reports;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load reports';
      setState(prev => ({ ...prev, error: message, loading: false }));
      throw err;
    }
  }, []);

  const downloadReport = useCallback(
    async (reportId: string, format: 'csv' | 'pdf' | 'json') => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        const blob = await dashboardAPI.downloadReport(reportId, format);
        setState(prev => ({ ...prev, loading: false }));
        return blob;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to download report';
        setState(prev => ({ ...prev, error: message, loading: false }));
        throw err;
      }
    },
    []
  );

  const shareProject = useCallback(
    async (projectId: string, recipients: string[]) => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        await projectAPI.shareProject(projectId, recipients);
        setState(prev => ({
          ...prev,
          loading: false,
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to share project';
        setState(prev => ({ ...prev, error: message, loading: false }));
        throw err;
      }
    },
    []
  );

  const getProjectStats = useCallback(async (projectId: string) => {
    try {
      return await projectAPI.getProjectStats(projectId);
    } catch (err) {
      console.error('Failed to get project stats:', err);
      return null;
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
    currentProject: state.currentProject,
    projects: state.projects,
    sharedProjects: state.sharedProjects,
    selectedProjects: state.selectedProjects,
    dashboardData: state.dashboardData,
    reports: state.reports,
    loading: state.loading,
    error: state.error,

    // Methods
    switchProject,
    createProject,
    loadProjects,
    loadSharedProjects,
    getProjectDetails,
    addProjectMember,
    removeProjectMember,
    updateProjectSettings,
    archiveProject,
    selectProjects,
    generateDashboard,
    generateReport,
    loadReports,
    downloadReport,
    shareProject,
    getProjectStats,
    clearError,
    resetState,
  };
};
