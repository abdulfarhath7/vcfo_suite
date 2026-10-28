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
 * The e-Filing grid (rule R-07, C-0007): a navy header with white text, a grid line on
 * every cell, zebra rows and page numbers under the table. The table scrolls inside its
 * card on narrow screens instead of spilling past it (K-38).
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
      <div className="max-w-full overflow-x-auto rounded-md border border-line">
        <table className="w-full table-fixed border-collapse text-[12.5px]" style={{ minWidth }}>
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <colgroup>
            {columns.map((c) => (
              <col key={c.key} style={c.width ? { width: c.width } : undefined} />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-navy text-on-navy">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn('border border-navy-hover px-2.5 py-2 text-[12px] font-semibold', alignClass(c.align))}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="border border-line px-3 py-6 text-center text-ink-muted">
                  {empty ?? 'Nothing to show.'}
                </td>
              </tr>
            ) : (
              shown.map((row, i) => (
                <tr
                  key={rowKey(row)}
                  className={cn(i % 2 === 1 ? 'bg-surface-sunken' : 'bg-surface-raised', onRowClick && 'cursor-pointer hover:bg-brand-soft')}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        'border border-line px-2.5 py-2 align-middle text-ink',
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
                'h-7 min-w-7 rounded-md border px-2 text-[12px] font-medium tabular-nums',
                n === current ? 'border-navy bg-navy text-on-navy' : 'border-line bg-surface-raised text-ink-muted hover:text-ink',
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
