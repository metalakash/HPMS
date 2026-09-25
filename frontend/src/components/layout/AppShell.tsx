import { Suspense } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { Spinner } from '@/components/common/Spinner';
import { useSessionCheck } from '@/hooks/queries';
import { useNotificationSocket } from '@/hooks/useNotificationSocket';
import { isSessionValid, useAuthStore } from '@/store/useAuthStore';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

/** Redirects to /login (remembering the target) when there is no valid session. */
export function ProtectedRoute() {
  const valid = useAuthStore(isSessionValid);
  const location = useLocation();
  if (!valid) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <AppShell />;
}

export function PageFallback() {
  return (
    <div className="flex justify-center py-16 text-primary">
      <Spinner />
    </div>
  );
}

function AppShell() {
  useSessionCheck();
  useNotificationSocket();

  return (
    <div className="flex h-full">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-fg focus:not-sr-only focus:fixed focus:left-2 focus:top-2"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main id="main" className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
