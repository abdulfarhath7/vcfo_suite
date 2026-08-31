'use client';

import { ChartFrame } from '@/components/charts/ChartFrame';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { useRecharts } from '@/components/charts/use-recharts';
import {
  CHART_CHROME,
  chartAxisProps,
  chartBarProps,
  chartGridProps,
  chartMargin,
  type ChartColor,
} from '@/components/charts/chart-theme';

export interface ChartSeries {
  /** Data key on each row. */
  key: string;
  /** Legend + tooltip label. */
  label: string;
  color: ChartColor;
  /** Same `stackId` across series stacks them. */
  stackId?: string;
}

export type ChartRow = Record<string, string | number>;

/**
 * The shared bar chart. `columns` for a category axis along the bottom,
 * `rows` for a horizontal ranking (top-N by count). Both take the same series
 * shape and the same themed axes, grid and tooltip.
 */
export function DashBarChart({
  data,
  categoryKey,
  series,
  layout = 'columns',
  height,
  loading,
  emptyLabel,
  valueFormatter,
  categoryWidth = 96,
  hideValueAxis = false,
}: {
  data: ChartRow[];
  categoryKey: string;
  series: ChartSeries[];
  layout?: 'columns' | 'rows';
  height?: number;
  loading?: boolean;
  emptyLabel?: string;
  valueFormatter?: (value: string | number | undefined) => string;
  /** Width reserved for category labels in `rows` layout. */
  categoryWidth?: number;
  hideValueAxis?: boolean;
}) {
  const RC = useRecharts();
  const empty = data.length === 0 || series.length === 0;
  const frameHeight = height ?? (layout === 'rows' ? Math.max(120, data.length * 34 + 24) : 176);

  if (!RC || empty) {
    return (
      <ChartFrame height={frameHeight} loading={(!RC || loading) && !empty} empty={empty} emptyLabel={emptyLabel}>
        <span />
      </ChartFrame>
    );
  }

  const { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } = RC;
  const isRows = layout === 'rows';

  return (
    <ChartFrame height={frameHeight}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={isRows ? 'vertical' : 'horizontal'}
          margin={isRows ? { top: 4, right: 12, left: 0, bottom: 0 } : chartMargin}
          barCategoryGap={isRows ? '22%' : '28%'}
        >
          <CartesianGrid {...chartGridProps} vertical={isRows} horizontal={!isRows} />
          {isRows ? (
            <>
              <XAxis type="number" allowDecimals={false} hide={hideValueAxis} {...chartAxisProps} />
              <YAxis
                type="category"
                dataKey={categoryKey}
                width={categoryWidth}
                interval={0}
                {...chartAxisProps}
              />
            </>
          ) : (
            <>
              <XAxis dataKey={categoryKey} interval={0} {...chartAxisProps} />
              <YAxis allowDecimals={false} hide={hideValueAxis} {...chartAxisProps} />
            </>
          )}
          <Tooltip
            cursor={{ fill: CHART_CHROME.cursor }}
            content={<ChartTooltip valueFormatter={valueFormatter} />}
          />
          {series.map((entry, index) => {
            const last = index === series.length - 1;
            const stacked = Boolean(entry.stackId);
            return (
              <Bar
                key={entry.key}
                dataKey={entry.key}
                name={entry.label}
                stackId={entry.stackId}
                fill={entry.color}
                maxBarSize={chartBarProps.maxBarSize}
                radius={
                  stacked && !last
                    ? [0, 0, 0, 0]
                    : isRows
                      ? [0, 4, 4, 0]
                      : chartBarProps.radius
                }
              />
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
