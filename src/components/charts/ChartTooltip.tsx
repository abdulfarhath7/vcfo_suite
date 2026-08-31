'use client';

import { CHART_CHROME } from '@/components/charts/chart-theme';

export interface ChartTooltipEntry {
  name?: string | number;
  value?: string | number;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
}

export interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: ChartTooltipEntry[];
  /** Rename a series for display without renaming its data key. */
  labelFor?: (entry: ChartTooltipEntry) => string;
  /** Format a value for display (percentages, day counts, currency). */
  valueFormatter?: (value: string | number | undefined, entry: ChartTooltipEntry) => string;
  /** Suppress zero rows in stacked charts, where most series are 0. */
  hideZero?: boolean;
}

/**
 * The one tooltip. Panel surface, 1px border, the dashboard's own type scale
 * and a token swatch per series — so a hover on any chart anywhere reads the
 * same. Pass as `<Tooltip content={<ChartTooltip />} />`; recharts injects
 * `active`, `label` and `payload`.
 */
export function ChartTooltip({
  active,
  label,
  payload,
  labelFor,
  valueFormatter,
  hideZero = true,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const rows = hideZero
    ? payload.filter((entry) => Number(entry.value ?? 0) !== 0)
    : payload;
  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-panel px-3 py-2 shadow-layered">
      {label !== undefined && label !== '' ? (
        <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.06em] text-text-tertiary">
          {label}
        </p>
      ) : null}
      <ul className="flex flex-col gap-1">
        {rows.map((entry, index) => (
          <li
            key={`${String(entry.dataKey ?? entry.name ?? index)}`}
            className="flex items-center gap-2 text-[12px] font-semibold text-ink"
          >
            <i
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: entry.color ?? CHART_CHROME.muted }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {labelFor ? labelFor(entry) : String(entry.name ?? entry.dataKey ?? '')}
            </span>
            <span className="shrink-0 tabular-nums">
              {valueFormatter ? valueFormatter(entry.value, entry) : String(entry.value ?? '—')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
