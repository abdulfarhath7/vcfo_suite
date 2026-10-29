import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A form field (prototype Field): the 13px label, the control, then a 12.5px muted hint or a red
 * error under it. Pass `htmlFor` when the control has an id; without it the label wraps the
 * control. Set `aria-invalid` on the control when there is an error (the input draws a red edge).
 */
export function Field({
  label,
  children,
  hint,
  error,
  htmlFor,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  const under = error ? (
    <span role="alert" className="text-[12.5px] text-danger">
      {error}
    </span>
  ) : hint ? (
    <span className="text-[12.5px] text-ink-muted">{hint}</span>
  ) : null;
  if (htmlFor)
    return (
      <div className={cn('grid gap-1.5', className)}>
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-2">
          {label}
        </label>
        {children}
        {under}
      </div>
    );
  return (
    // eslint-disable-next-line jsx-a11y/label-has-associated-control -- the control is the child.
    <label className={cn('grid gap-1.5', className)}>
      <span className="text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {under}
    </label>
  );
}
