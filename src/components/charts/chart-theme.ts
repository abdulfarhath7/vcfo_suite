/**
 * SHARED CHART THEME — the one place chart colour and axis styling is decided.
 *
 * Every chart on every dashboard reads from here, so a chart drawn on the super
 * admin overview and a chart drawn on the client dashboard are visually
 * identical and a future rebrand reskins both through `globals.css` alone.
 *
 * Rules encoded here (context §2, §6, §10):
 *   - colour comes from design tokens only — zero hardcoded hex,
 *   - status colour appears in chart FILLS, never as a page or panel fill,
 *   - categorical series follow one stable order so the same category keeps its
 *     hue across screens,
 *   - phase fills reuse `--phase-*`, the same tokens the journey bars use.
 *
 * Pure module: no React, no recharts import, so it is safe to pull into server
 * code or tests.
 */

import { phaseKeyFromId, type PhaseColorKey } from '@/lib/phase-colors';

/** A CSS colour built from a design token. */
export type ChartColor = string;

const token = (name: string): ChartColor => `oklch(var(--${name}))`;
const tokenAlpha = (name: string, alpha: number): ChartColor =>
  `oklch(var(--${name}) / ${alpha})`;

/** Chrome: axes, grid, tooltip surface, reference lines. */
export const CHART_CHROME = {
  grid: token('border'),
  axis: token('text-tertiary'),
  reference: tokenAlpha('text-tertiary', 0.7),
  surface: token('panel'),
  ink: token('ink'),
  muted: token('muted-foreground'),
  cursor: tokenAlpha('primary', 0.08),
} as const;

/**
 * Status fills. The same four words the whole product uses:
 * teal done · coral waiting · slate lock · rose overdue.
 */
export const CHART_STATUS: Record<
  'done' | 'active' | 'waiting' | 'locked' | 'overdue',
  ChartColor
> = {
  done: token('success'),
  active: token('primary'),
  waiting: token('accent-orange'),
  locked: token('text-tertiary'),
  overdue: token('danger'),
};

/** Journey phase fills — the same tokens `LeadPhaseProgress` paints its bars with. */
export const CHART_PHASE: Record<PhaseColorKey, ChartColor> = {
  pre: token('phase-pre'),
  filing: token('phase-filing'),
  post: token('phase-post'),
  fema: token('phase-fema'),
  registration: token('phase-registration'),
  default: token('primary'),
};

export function chartPhaseColor(phaseId: string, bucket?: string): ChartColor {
  return CHART_PHASE[phaseKeyFromId(phaseId, bucket)];
}

/**
 * Categorical scale for series that are not statuses — six hues, matching the
 * `CATEGORICAL_TONES` order in `IconChip` so a category chipped sky in a list
 * is also sky in a chart. Six is the cap: donuts must stay at or under six
 * slices (§10), and a legend past six stops being readable.
 */
export const CHART_SERIES: ChartColor[] = [
  token('accent-sky'),
  token('accent-violet'),
  token('accent-emerald'),
  token('accent-amber'),
  token('accent-rose'),
  token('accent-teal'),
];

export function chartSeriesColor(index: number): ChartColor {
  return CHART_SERIES[index % CHART_SERIES.length]!;
}

/** Stable hue for an arbitrary key (a manager name, an authority code). */
export function chartColorForKey(key: string): ChartColor {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return chartSeriesColor(Math.abs(hash));
}

/** Type scale — matches the dashboard's 10.5/11/11.5px label rhythm. */
export const CHART_FONT_SIZE = 11;

/** Default axis props. Spread these; never restyle an axis inline. */
export const chartAxisProps = {
  tick: { fontSize: CHART_FONT_SIZE, fill: CHART_CHROME.axis },
  axisLine: false,
  tickLine: false,
} as const;

/** Default cartesian grid props — horizontal rules only, so bars stay readable. */
export const chartGridProps = {
  stroke: CHART_CHROME.grid,
  strokeDasharray: '3 3',
  vertical: false,
} as const;

/** Default plot margins. Negative left pulls a short numeric axis back in. */
export const chartMargin = { top: 8, right: 8, left: -18, bottom: 0 } as const;

/** Default bar geometry — rounded top, capped width so few bars stay elegant. */
export const chartBarProps = {
  radius: [4, 4, 0, 0] as [number, number, number, number],
  maxBarSize: 44,
} as const;

/** Default line geometry. */
export const chartLineProps = {
  type: 'monotone' as const,
  strokeWidth: 2,
  dot: false,
  activeDot: { r: 4, strokeWidth: 2, stroke: CHART_CHROME.surface },
};
