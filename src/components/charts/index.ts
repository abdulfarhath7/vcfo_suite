/**
 * SHARED CHART LAYER (context §9).
 *
 * Every chart in every dashboard is built from these. Do not style a chart
 * ad hoc, and do not import recharts directly in a view — go through
 * `DashBarChart` / `DashLineChart`, or `useRecharts` + `chart-theme` if a chart
 * type is genuinely missing, and then add it here.
 */

export {
  CHART_CHROME,
  CHART_PHASE,
  CHART_SERIES,
  CHART_STATUS,
  chartAxisProps,
  chartBarProps,
  chartColorForKey,
  chartGridProps,
  chartLineProps,
  chartMargin,
  chartPhaseColor,
  chartSeriesColor,
  type ChartColor,
} from '@/components/charts/chart-theme';
export { ChartFrame } from '@/components/charts/ChartFrame';
export { ChartTooltip, type ChartTooltipEntry } from '@/components/charts/ChartTooltip';
export { ChartLegend, type ChartLegendItem } from '@/components/charts/ChartLegend';
export { DashBarChart, type ChartRow, type ChartSeries } from '@/components/charts/DashBarChart';
export { DashLineChart } from '@/components/charts/DashLineChart';
export { useRecharts, type RechartsModule } from '@/components/charts/use-recharts';
