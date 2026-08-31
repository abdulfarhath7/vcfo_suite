'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * THE data table. Factored out of the lead dashboard's `MyWork` list view so
 * long lists (engagements, activity, documents) never invent a second table
 * style: same header type scale, same `border-t border-border` rows, same
 * `hover:bg-raised/70`, same 13px semibold row text.
 *
 * Wide layout is a CSS grid (not `<table>`) so columns can be sized in `fr`
 * units and a row can collapse to a stacked card below `xl`, exactly as the
 * lead dashboard's list does. Pass `mobile` to control that collapsed shape.
 */

export interface DashColumn<Row> {
  key: string;
  header: string;
  /** Grid track for this column, e.g. `minmax(0,1.5fr)` or `auto`. */
  width: string;
  align?: 'left' | 'right';
  /** Mono type for identifiers, dates, counts — matches the lead dashboard. */
  mono?: boolean;
  render: (row: Row) => ReactNode;
}

export function DashDataTable<Row>({
  columns,
  rows,
  rowKey,
  rowHref,
  mobile,
  empty = 'Nothing here yet.',
  bare = false,
  className,
}: {
  columns: DashColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  /** Makes the whole row a link target. Cells may still hold their own links. */
  rowHref?: (row: Row) => string | undefined;
  mobile?: (row: Row) => ReactNode;
  empty?: ReactNode;
  /** Skip the `.surface` shell — for a table already inside a `DashSection`. */
  bare?: boolean;
  className?: string;
}) {
  const template = columns.map((column) => column.width).join(' ');

  if (rows.length === 0) {
    const body = <p className="px-3.5 py-6 text-center text-[12.5px] text-muted-foreground">{empty}</p>;
    return bare ? body : <div className={cn('surface overflow-hidden', className)}>{body}</div>;
  }

  const table = (
    <>
      <div
        className={cn(
          'hidden text-[10.5px] font-extrabold uppercase tracking-[0.07em] text-text-tertiary xl:grid',
        )}
        style={{ gridTemplateColumns: template }}
      >
        {columns.map((column) => (
          <div
            key={column.key}
            className={cn('min-w-0 px-3.5 py-2.5', column.align === 'right' && 'text-right')}
          >
            {column.header}
          </div>
        ))}
      </div>

      {rows.map((row) => {
        const href = rowHref?.(row);
        const wide = (
          <div
            className="hidden items-center xl:grid"
            style={{ gridTemplateColumns: template }}
          >
            {columns.map((column) => (
              <div
                key={column.key}
                className={cn(
                  'min-w-0 overflow-hidden px-3.5 py-3',
                  column.align === 'right' && 'text-right',
                  column.mono && 'font-mono text-[11.5px]',
                )}
              >
                {column.render(row)}
              </div>
            ))}
          </div>
        );

        const narrow = mobile ? <div className="px-3.5 py-3 xl:hidden">{mobile(row)}</div> : null;

        const inner = (
          <>
            {narrow}
            {wide}
          </>
        );

        return (
          <div
            key={rowKey(row)}
            className="border-t border-border text-[13px] font-semibold transition-colors first:border-t-0 hover:bg-raised/70 xl:first:border-t"
          >
            {href ? (
              <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
                {inner}
              </Link>
            ) : (
              inner
            )}
          </div>
        );
      })}
    </>
  );

  return bare ? (
    <div className={cn('min-w-0', className)}>{table}</div>
  ) : (
    <div className={cn('surface overflow-hidden', className)}>{table}</div>
  );
}
