'use client';

import type { ReactNode } from 'react';
import { X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BulkAction {
  key: string;
  /** "Assign", "Remind", "Mark done", "Export". */
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  disabled?: boolean;
  /** A whole control instead of a button, for an action that opens a menu (Assign to a person). Style it with `BULK_BUTTON`. */
  render?: (count: number) => ReactNode;
}

/** The bulk bar's button look, for a custom `render` trigger. */
export const BULK_BUTTON =
  'inline-flex h-[30px] flex-none items-center gap-1.5 rounded-md border-1.5 border-line-strong bg-surface-raised px-2.5 text-[13px] font-medium normal-case tracking-normal text-ink hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25 disabled:pointer-events-none disabled:opacity-50 data-[state=open]:bg-surface-sunken max-sm:w-[30px] max-sm:justify-center max-sm:px-0';

/**
 * E-01 bulk actions bar (VCFO Spectrum): shows while rows are picked, with the count, an optional
 * "Select all n rows" link, the actions the screen passes in, and a clear button. On a phone the
 * actions are icon buttons that keep their names for screen readers. It renders nothing when no
 * row is picked. `EFilingGrid` lays it over its head row; a screen can also place it itself.
 */
export function BulkBar({
  count,
  total,
  pageAll,
  onSelectAll,
  onClear,
  actions,
  noun = ['row', 'rows'],
  className,
}: {
  count: number;
  /** Rows in the whole list, for "Select all n rows". */
  total?: number;
  /** Every row on this page is picked; with `total` and `onSelectAll` this offers the rest. */
  pageAll?: boolean;
  onSelectAll?: () => void;
  onClear: () => void;
  actions: BulkAction[];
  /** Singular and plural: ["task", "tasks"]. */
  noun?: [string, string];
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className={cn('flex min-w-0 flex-1 items-center gap-2 text-[13px] font-medium normal-case tracking-normal text-ink', className)}
    >
      <span className="whitespace-nowrap" aria-live="polite">
        {count} selected
      </span>
      {pageAll && onSelectAll && total !== undefined && count < total ? (
        <button type="button" onClick={onSelectAll} className="whitespace-nowrap text-brand-text hover:underline">
          Select all {total} {noun[1]}
        </button>
      ) : null}
      <span className="ml-auto flex items-center gap-1.5">
        {actions.map((a) =>
          a.render ? (
            <span key={a.key} className="contents">
              {a.render(count)}
            </span>
          ) : (
            <button
              key={a.key}
              type="button"
              className={BULK_BUTTON}
              onClick={a.onClick}
              disabled={a.disabled}
              aria-label={`${a.label} ${count} ${count === 1 ? noun[0] : noun[1]}`}
            >
              {a.icon ? <a.icon className="h-[15px] w-[15px]" strokeWidth={1.6} aria-hidden /> : null}
              <span className="max-sm:sr-only" aria-hidden>
                {a.label}
              </span>
            </button>
          ),
        )}
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          title="Clear selection"
          className="grid h-[30px] w-[30px] flex-none place-items-center rounded-md text-ink-muted hover:bg-ink/[.06] hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25"
        >
          <X className="h-[15px] w-[15px]" strokeWidth={1.6} aria-hidden />
        </button>
      </span>
    </div>
  );
}
