'use client';

import { cn } from '@/lib/utils';

/**
 * The list filter chip, lifted verbatim from the lead dashboard's `MyWork`
 * filter row so every filtered list in the product uses one chip, one radius,
 * one active state. `MyWork`'s private copy should adopt this next.
 */
export function DashFilterChip({
  on,
  label,
  count,
  onClick,
}: {
  on: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        'rounded-sm border border-line bg-surface-raised px-3.5 py-1.5 text-xs font-semibold text-ink-muted hover:border-line',
        on && 'border-transparent bg-brand-soft text-brand-strong',
      )}
    >
      {label}
      {count === undefined ? null : <span className="ml-1.5 opacity-70 tabular-nums">{count}</span>}
    </button>
  );
}
