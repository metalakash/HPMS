import { lazy } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router';
import { ProtectedRoute } from '@/components/layout/AppShell';

// Route-level code splitting: each page is its own chunk.
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const ProjectsPage = lazy(() => import('@/pages/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('@/pages/ProjectDetailPage'));
const LoansPage = lazy(() => import('@/pages/LoansPage'));
const ApprovalQueuePage = lazy(() => import('@/pages/ApprovalQueuePage'));
const CompliancePage = lazy(() => import('@/pages/CompliancePage'));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'));
const ProjectionPage = lazy(() => import('@/pages/ProjectionPage'));
const EnergyFinancingPage = lazy(() => import('@/pages/EnergyFinancingPage'));
const MaintenancePage = lazy(() => import('@/pages/MaintenancePage'));
const AdminPage = lazy(() => import('@/pages/AdminPage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
const RegulatoryPage = lazy(() => import('@/pages/RegulatoryPage'));
const SecurityPage = lazy(() => import('@/pages/SecurityPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'projects/:id', element: <ProjectDetailPage /> },
      { path: 'loans', element: <LoansPage /> },
      { path: 'approvals', element: <ApprovalQueuePage /> },
      { path: 'compliance', element: <CompliancePage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
      { path: 'projection', element: <ProjectionPage /> },
      { path: 'energy-financing', element: <EnergyFinancingPage /> },
      { path: 'maintenance', element: <MaintenancePage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'regulatory', element: <RegulatoryPage /> },
      { path: 'admin', element: <AdminPage /> },
      { path: 'security', element: <SecurityPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const createAppRouter = () => createBrowserRouter(routes);
