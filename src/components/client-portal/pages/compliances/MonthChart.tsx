'use client';

/**
 * "Filings by month" (prototype FilingsScreen MonthChart): a 232px stacked column chart of the
 * financial year, April to March, one column per month stacked by status in the R-25 status fills.
 * A click on a column opens the drill-down with that month's filings (rule 14). Built on the shared
 * chart layer (`useRecharts` and `chart-theme`) because the shared `DashBarChart` takes no click.
 */
import { useMemo } from 'react';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { useRecharts } from '@/components/charts/use-recharts';
import { CHART_CHROME, CHART_STATUS, chartAxisProps, chartGridProps } from '@/components/charts/chart-theme';
import { MON, MONTHS, fyLabelOf, fyMonths, statusOf, type CompStatus, type PortalFiling } from '@/lib/client-portal/compliances';
import { SCard, WORD } from './spectrum';

/** Stack order from the axis up: done first, then the open buckets. */
const STACK: CompStatus[] = ['ok', 'due', 'over', 'up'];
const COLOR: Record<CompStatus, string> = { ok: CHART_STATUS.done, due: CHART_STATUS.due, over: CHART_STATUS.overdue, up: CHART_STATUS.locked };

export function MonthChart({
  rows,
  fy,
  today,
  onDrill,
}: {
  /** Every filing of the financial year. */
  rows: PortalFiling[];
  fy: number;
  today: string;
  onDrill: (title: string, list: PortalFiling[]) => void;
}) {
  const RC = useRecharts();
  const months = useMemo(() => fyMonths(fy), [fy]);
  const data = useMemo(
    () =>
      months.map((key) => {
        const inMonth = rows.filter((r) => r.dueDate.startsWith(key));
        const row: Record<string, string | number> = { m: MON[Number(key.slice(5, 7)) - 1]!, key };
        for (const s of STACK) row[s] = inMonth.filter((r) => statusOf(r, today) === s).length;
        return row;
      }),
    [months, rows, today],
  );
  const drill = (i: number) => {
    const key = months[i];
    if (!key) return;
    const m = Number(key.slice(5, 7)) - 1;
    onDrill(`Filings · ${MONTHS[m]} ${key.slice(0, 4)}`, rows.filter((r) => r.dueDate.startsWith(key)));
  };

  return (
    <SCard title="Filings by month" meta={fyLabelOf(fy)}>
      {!RC ? (
        <ChartFrame height={232} loading>
          <span />
        </ChartFrame>
      ) : (
        <ChartFrame height={232}>
          <RC.ResponsiveContainer width="100%" height="100%">
            <RC.BarChart
              data={data}
              margin={{ top: 4, right: 4, bottom: 0, left: -24 }}
              barCategoryGap="28%"
              className="cursor-pointer"
              accessibilityLayer
              onClick={(e) => {
                const raw = (e as { activeTooltipIndex?: number | string } | null)?.activeTooltipIndex;
                const i = typeof raw === 'number' ? raw : Number(raw);
                if (Number.isInteger(i) && i >= 0) drill(i);
              }}
            >
              <RC.CartesianGrid {...chartGridProps} />
              <RC.XAxis dataKey="m" interval={0} {...chartAxisProps} axisLine={{ stroke: CHART_CHROME.grid }} />
              <RC.YAxis allowDecimals={false} {...chartAxisProps} />
              <RC.Tooltip cursor={{ fill: CHART_CHROME.cursor }} content={<ChartTooltip />} />
              {STACK.map((s) => (
                <RC.Bar key={s} dataKey={s} name={WORD[s]} stackId="a" fill={COLOR[s]} isAnimationActive={false} maxBarSize={28} />
              ))}
            </RC.BarChart>
          </RC.ResponsiveContainer>
        </ChartFrame>
      )}
      {/* Screen readers and keyboards get the same drill as a list of month buttons. */}
      <ul className="sr-only">
        {data.map((d, i) => (
          <li key={String(d.key)}>
            <button type="button" onClick={() => drill(i)}>
              {`${d.m}: ${STACK.map((s) => `${d[s]} ${WORD[s].toLowerCase()}`).join(', ')}. Show the filings`}
            </button>
          </li>
        ))}
      </ul>
    </SCard>
  );
}

