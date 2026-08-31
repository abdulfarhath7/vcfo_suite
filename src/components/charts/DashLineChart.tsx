'use client';

import { ChartFrame } from '@/components/charts/ChartFrame';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { useRecharts } from '@/components/charts/use-recharts';
import type { ChartRow, ChartSeries } from '@/components/charts/DashBarChart';
import {
  CHART_CHROME,
  chartAxisProps,
  chartGridProps,
  chartLineProps,
  chartMargin,
} from '@/components/charts/chart-theme';

/**
 * The shared trend chart. `area` fills under the line for volume-over-time;
 * plain lines for rates. Same axes, grid and tooltip as every other chart.
 */
export function DashLineChart({
  data,
  categoryKey,
  series,
  area = false,
  height = 176,
  loading,
  emptyLabel,
  valueFormatter,
  reference,
}: {
  data: ChartRow[];
  categoryKey: string;
  series: ChartSeries[];
  area?: boolean;
  height?: number;
  loading?: boolean;
  emptyLabel?: string;
  valueFormatter?: (value: string | number | undefined) => string;
  /** Optional dashed benchmark line. */
  reference?: { value: number; label?: string };
}) {
  const RC = useRecharts();
  const empty = data.length === 0 || series.length === 0;

  if (!RC || empty) {
    return (
      <ChartFrame height={height} loading={(!RC || loading) && !empty} empty={empty} emptyLabel={emptyLabel}>
        <span />
      </ChartFrame>
    );
  }

  const {
    Area,
    AreaChart,
    CartesianGrid,
    Line,
    LineChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
  } = RC;

  const Chart = area ? AreaChart : LineChart;

  return (
    <ChartFrame height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={data} margin={chartMargin}>
          <defs>
            {area
              ? series.map((entry) => (
                  <linearGradient
                    key={entry.key}
                    id={`dash-area-${entry.key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={entry.color} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={entry.color} stopOpacity={0.02} />
                  </linearGradient>
                ))
              : null}
          </defs>
          <CartesianGrid {...chartGridProps} />
          <XAxis dataKey={categoryKey} {...chartAxisProps} />
          <YAxis allowDecimals={false} {...chartAxisProps} />
          <Tooltip
            cursor={{ stroke: CHART_CHROME.grid }}
            content={<ChartTooltip valueFormatter={valueFormatter} hideZero={false} />}
          />
          {reference ? (
            <ReferenceLine
              y={reference.value}
              stroke={CHART_CHROME.reference}
              strokeDasharray="4 4"
              label={
                reference.label
                  ? {
                      value: reference.label,
                      position: 'insideTopRight',
                      fill: CHART_CHROME.axis,
                      fontSize: 10.5,
                    }
                  : undefined
              }
            />
          ) : null}
          {series.map((entry) =>
            area ? (
              <Area
                key={entry.key}
                dataKey={entry.key}
                name={entry.label}
                type={chartLineProps.type}
                stroke={entry.color}
                strokeWidth={chartLineProps.strokeWidth}
                fill={`url(#dash-area-${entry.key})`}
                activeDot={{ ...chartLineProps.activeDot, fill: entry.color }}
                stackId={entry.stackId}
              />
            ) : (
              <Line
                key={entry.key}
                dataKey={entry.key}
                name={entry.label}
                type={chartLineProps.type}
                stroke={entry.color}
                strokeWidth={chartLineProps.strokeWidth}
                dot={chartLineProps.dot}
                activeDot={{ ...chartLineProps.activeDot, fill: entry.color }}
              />
            ),
          )}
        </Chart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
