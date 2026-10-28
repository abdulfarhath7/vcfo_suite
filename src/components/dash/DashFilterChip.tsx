'use client';

import { cn } from '@/lib/utils';

/**
 * The list filter chip (VCFO Spectrum R-10, Q3): a rounded rectangle. A set filter has a soft
 * blurple fill; an unset one is a quiet white chip with a 1.5px edge. Every filtered list in
 * the product uses this one chip.
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
        'inline-flex h-[30px] items-center rounded-md border-1.5 border-line bg-surface-raised px-3 text-[13px] font-medium text-ink-2 hover:border-line-strong',
        on && 'border-brand-line bg-brand-soft text-brand-text hover:border-brand-line',
      )}
    >
      {label}
      {count === undefined ? null : <span className="ml-1.5 opacity-70 tabular-nums">{count}</span>}
    </button>
  );
}
