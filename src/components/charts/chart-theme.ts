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
const CHART_PHASE: Record<PhaseColorKey, ChartColor> = {
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

/** Type scale — matches the dashboard's 10.5/11/11.5px label rhythm. */
const CHART_FONT_SIZE = 11;

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

