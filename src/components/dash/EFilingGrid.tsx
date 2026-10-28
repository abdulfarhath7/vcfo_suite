'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type EFilingColumn<T> = {
  key: string;
  header: ReactNode;
  /** CSS width, for example '120px' or '18%'. */
  width?: string;
  align?: 'left' | 'right' | 'center';
  /** Let the cell wrap instead of truncating. */
  wrap?: boolean;
  render: (row: T) => ReactNode;
};

/**
 * The grid (VCFO Spectrum rule R-07, Stripe T1): clean rows. A 36px head in 11.5px capitals
 * with a 1.5px line under it, 44px rows with one hairline, no column lines, no zebra, no navy
 * head. Page numbers sit under long tables. The table scrolls inside its card on narrow
 * screens instead of spilling past it (K-38).
 */
export function EFilingGrid<T>({
  columns,
  rows,
  rowKey,
  pageSize = 10,
  empty,
  onRowClick,
  caption,
  minWidth = 640,
}: {
  columns: EFilingColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  pageSize?: number;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  caption?: string;
  minWidth?: number;
}) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * pageSize, current * pageSize + pageSize);
  const alignClass = (a?: 'left' | 'right' | 'center') => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left');

  return (
    <div className="min-w-0">
      <div className="max-w-full overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-[14px]" style={{ minWidth }}>
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <colgroup>
            {columns.map((c) => (
              <col key={c.key} style={c.width ? { width: c.width } : undefined} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    'h-9 whitespace-nowrap border-b-1.5 border-line px-2.5 text-[11.5px] font-medium uppercase tracking-[.07em] text-ink-muted',
                    alignClass(c.align),
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-ink-muted">
                  {empty ?? 'Nothing to show.'}
                </td>
              </tr>
            ) : (
              shown.map((row) => (
                <tr
                  key={rowKey(row)}
                  className={cn('hover:bg-surface-sunken/60', onRowClick && 'cursor-pointer')}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        'h-11 border-b border-line-soft px-2.5 align-middle text-ink-2',
                        alignClass(c.align),
                        c.wrap ? 'whitespace-normal' : 'truncate whitespace-nowrap',
                      )}
                    >
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 ? (
        <nav aria-label="Pages" className="mt-2 flex flex-wrap items-center justify-end gap-1">
          {Array.from({ length: pages }, (_, n) => (
            <button
              key={n}
              type="button"
              aria-current={n === current ? 'page' : undefined}
              onClick={() => setPage(n)}
              className={cn(
                'h-7 min-w-7 rounded-md border-1.5 px-2 text-[12px] font-medium tabular-nums',
                n === current ? 'border-brand bg-brand text-on-brand' : 'border-line bg-surface-raised text-ink-muted hover:text-ink',
              )}
            >
              {n + 1}
            </button>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
