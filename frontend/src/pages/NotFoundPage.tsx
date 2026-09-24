import { Link } from 'react-router';
import { EmptyState } from '@/components/common/States';

export default function NotFoundPage() {
  return (
    <EmptyState
      title="Page not found"
      description="The page you were looking for doesn't exist."
      action={
        <Link to="/" className="text-sm font-medium text-primary hover:underline">
          Go to dashboard
        </Link>
      }
    />
  );
}
