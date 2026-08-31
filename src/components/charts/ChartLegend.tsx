'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { ChartColor } from '@/components/charts/chart-theme';

export interface ChartLegendItem {
  label: string;
  color: ChartColor;
  count?: number;
  href?: string;
}

/**
 * The one chart legend — the same swatch, weight and `label · count` shape as
 * `DashLegendRow` next to a donut, so a bar chart's legend and a donut's legend
 * are the same object. `row` stacks; `inline` wraps under a plot.
 */
export function ChartLegend({
  items,
  layout = 'inline',
  className,
}: {
  items: ChartLegendItem[];
  layout?: 'inline' | 'stack';
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <ul
      className={cn(
        layout === 'stack'
          ? 'flex min-w-0 flex-col gap-1.5'
          : 'flex flex-wrap items-center gap-x-3 gap-y-1',
        className,
      )}
    >
      {items.map((item) => {
        const body = (
          <>
            <i
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: item.color }}
              aria-hidden
            />
            <span className="min-w-0 truncate">
              {item.label}
              {item.count === undefined ? '' : ` · ${item.count}`}
            </span>
          </>
        );
        const rowClass =
          'flex min-w-0 items-center gap-2 text-[11.5px] font-bold text-muted-foreground';
        return (
          <li key={item.label} className="min-w-0">
            {item.href ? (
              <Link href={item.href} className={cn(rowClass, 'hover:text-ink')}>
                {body}
              </Link>
            ) : (
              <span className={rowClass}>{body}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
