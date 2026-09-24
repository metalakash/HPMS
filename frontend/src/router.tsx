import { lazy } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router';
import { ProtectedRoute } from '@/components/layout/AppShell';

// Route-level code splitting: each page is its own chunk.
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const ProjectsPage = lazy(() => import('@/pages/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('@/pages/ProjectDetailPage'));
const LoansPage = lazy(() => import('@/pages/LoansPage'));
const UnavailablePage = lazy(() => import('@/pages/UnavailablePage'));
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
      {
        path: 'compliance',
        element: (
          <UnavailablePage
            title="Compliance"
            description="Covenant monitoring, alerts and audit trail"
          />
        ),
      },
      {
        path: 'analytics',
        element: (
          <UnavailablePage
            title="Analytics"
            description="Generation forecasts, anomalies and risk scores"
          />
        ),
      },
      {
        path: 'maintenance',
        element: (
          <UnavailablePage
            title="Maintenance"
            description="Schedules, work orders and equipment history"
          />
        ),
      },
      {
        path: 'admin',
        element: (
          <UnavailablePage title="Admin" description="Users, organization settings and API keys" />
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const createAppRouter = () => createBrowserRouter(routes);
