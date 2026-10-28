'use client';

import { useRecharts } from '@/components/charts/use-recharts';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import {
  CHART_CHROME,
  CHART_STATUS,
  chartAxisProps,
  chartBarProps,
  chartGridProps,
  chartReferenceProps,
} from '@/components/charts/chart-theme';

type ChartRow = {
  m: string;
  completion: number;
  target: number;
  delay: number;
  benchmark: number;
};

/* VCFO Spectrum Analytics charts (prototype AnalyticsScreen.tsx, rule R-25): status colours
   only. A month at or above target is green, below target blurple; the target and the
   benchmark are amber dashed lines. */

function ChartPlaceholder() {
  return <div className="h-full w-full animate-pulse rounded-md bg-surface-sunken" aria-hidden />;
}

export function AnalyticsCompletionChart({ data, target = 95 }: { data: ChartRow[]; target?: number }) {
  const RC = useRecharts();
  if (!RC) return <ChartPlaceholder />;

  const { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } = RC;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 16, right: 4, left: -10, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid {...chartGridProps} />
        <XAxis dataKey="m" interval={0} {...chartAxisProps} />
        <YAxis domain={[70, 100]} unit="%" allowDecimals={false} {...chartAxisProps} />
        <Tooltip
          cursor={{ fill: CHART_CHROME.cursor }}
          content={<ChartTooltip valueFormatter={(v) => `${v}% on time`} />}
        />
        <ReferenceLine y={target} {...chartReferenceProps(`${target}% target`)} />
        <Bar
          dataKey="completion"
          name="Rate"
          isAnimationActive={false}
          maxBarSize={chartBarProps.maxBarSize}
          radius={chartBarProps.radius}
        >
          {data.map((r) => (
            <Cell key={r.m} fill={r.completion >= target ? CHART_STATUS.done : CHART_STATUS.active} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AnalyticsDelayChart({ data, benchmark = 2 }: { data: ChartRow[]; benchmark?: number }) {
  const RC = useRecharts();
  if (!RC) return <ChartPlaceholder />;

  const { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } = RC;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 16, right: 12, left: -24, bottom: 0 }}>
        <CartesianGrid {...chartGridProps} />
        <XAxis dataKey="m" interval={0} {...chartAxisProps} />
        <YAxis domain={[0, 5]} {...chartAxisProps} />
        <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v} days`} />} />
        <ReferenceLine y={benchmark} {...chartReferenceProps(`${benchmark}d benchmark`)} />
        <Line
          type="monotone"
          dataKey="delay"
          name="Delay"
          stroke={CHART_STATUS.active}
          strokeWidth={2}
          isAnimationActive={false}
          dot={{ r: 4, fill: CHART_CHROME.surface, stroke: CHART_STATUS.active, strokeWidth: 2 }}
          activeDot={{ r: 5, fill: CHART_STATUS.active, stroke: CHART_CHROME.surface, strokeWidth: 2 }}
          label={{ position: 'top', fill: CHART_CHROME.ink, fontSize: 11 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
