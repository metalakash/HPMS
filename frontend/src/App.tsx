import { Suspense, useState, type ReactNode } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { PageFallback } from '@/components/layout/AppShell';
import { useApplyTheme } from '@/hooks/useApplyTheme';
import { createQueryClient } from '@/queryClient';
import { createAppRouter } from '@/router';

export function AppProviders({
  children,
  queryClient,
}: {
  children: ReactNode;
  queryClient: QueryClient;
}) {
  useApplyTheme();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

export default function App() {
  const [queryClient] = useState(createQueryClient);
  const [router] = useState(createAppRouter);

  return (
    <AppProviders queryClient={queryClient}>
      <Suspense fallback={<PageFallback />}>
        <RouterProvider router={router} />
      </Suspense>
    </AppProviders>
  );
}
