import { cn } from '@/utils/cn';

export function Spinner({
  size = 'md',
  label = 'Loading',
}: {
  size?: 'sm' | 'md';
  label?: string;
}) {
  return (
    <span role={label ? 'status' : undefined} className="inline-flex items-center">
      <span
        aria-hidden="true"
        className={cn(
          'animate-spin rounded-full border-2 border-current border-t-transparent',
          size === 'sm' ? 'size-4' : 'size-6',
        )}
      />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}
