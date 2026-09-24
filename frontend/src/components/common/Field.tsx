import { useId, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

const control =
  'h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-fg placeholder:text-muted ' +
  'disabled:opacity-60 aria-invalid:border-danger';

interface FieldProps {
  label: string;
  error?: string;
  hideLabel?: boolean;
}

export function Input({
  label,
  error,
  hideLabel,
  className,
  id,
  ...props
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className={cn('text-sm font-medium', hideLabel && 'sr-only')}>
        {label}
      </label>
      <input
        id={inputId}
        className={control}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export function Select({
  label,
  hideLabel,
  options,
  placeholder,
  className,
  id,
  ...props
}: FieldProps & {
  options: SelectOption[];
  placeholder?: string;
} & SelectHTMLAttributes<HTMLSelectElement>) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={selectId} className={cn('text-sm font-medium', hideLabel && 'sr-only')}>
        {label}
      </label>
      <select id={selectId} className={control} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
