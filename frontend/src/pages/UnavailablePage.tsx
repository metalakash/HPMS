import { Construction } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/States';
import { PageHeader } from '@/components/layout/PageHeader';

/**
 * Placeholder for Task 6.2 screens whose backend modules (backend/app/compliance,
 * backend/app/analytics) exist but are not yet exposed as REST routes.
 */
export default function UnavailablePage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card>
        <EmptyState
          icon={<Construction className="size-8" />}
          title="Coming in Task 6.2"
          description="This screen needs API endpoints that the backend does not expose yet."
        />
      </Card>
    </>
  );
}
