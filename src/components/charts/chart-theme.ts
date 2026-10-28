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

import { phaseKeyFromId, type PhaseColorKey } from '@/lib/shell/phase-colors';

/** A CSS colour built from a design token. */
export type ChartColor = string;

const token = (name: string): ChartColor => `oklch(var(--${name}))`;

/**
 * Chrome: axes, grid, tooltip surface, reference lines. VCFO Spectrum (rule R-25): a soft
 * hairline grid, muted axis labels, a raised white tooltip and an amber dashed target line.
 */
export const CHART_CHROME = {
  grid: token('line-soft'),
  axis: token('ink-muted'),
  reference: token('warning-mid'),
  referenceText: token('warning'),
  surface: token('surface-raised'),
  ink: token('ink'),
  muted: token('ink-muted'),
  cursor: token('surface-sunken'),
} as const;

/**
 * Status fills (rule R-25: charts use status colours only). The six meanings the whole
 * product uses: done green, in progress blurple, waiting teal, due soon amber, not started
 * grey, overdue red. `active` and `locked` keep their old names for callers.
 */
export const CHART_STATUS: Record<
  'done' | 'active' | 'waiting' | 'due' | 'locked' | 'overdue',
  ChartColor
> = {
  done: token('positive-mid'),
  active: token('brand'),
  waiting: token('waiting-mid'),
  due: token('warning-mid'),
  locked: token('upcoming-mid'),
  overdue: token('danger-mid'),
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

/** Type scale: the prototype's 11.5px axis labels. */
const CHART_FONT_SIZE = 11.5;

/** Default axis props. Spread these; never restyle an axis inline. */
export const chartAxisProps = {
  tick: { fontSize: CHART_FONT_SIZE, fill: CHART_CHROME.axis },
  axisLine: false,
  tickLine: false,
} as const;

/** Default cartesian grid props: solid horizontal hairlines only, so bars stay readable. */
export const chartGridProps = {
  stroke: CHART_CHROME.grid,
  vertical: false,
} as const;

/** Default plot margins. Negative left pulls a short numeric axis back in. */
export const chartMargin = { top: 8, right: 8, left: -18, bottom: 0 } as const;

/** Default bar geometry: the 3px bar corner (`rounded-bar`) on top, capped width. */
export const chartBarProps = {
  radius: [3, 3, 0, 0] as [number, number, number, number],
  maxBarSize: 36,
} as const;

/** A dashed target or benchmark line with its label in the top right (prototype Analytics). */
export function chartReferenceProps(label: string) {
  return {
    stroke: CHART_CHROME.reference,
    strokeDasharray: '6 5',
    label: { value: label, position: 'insideTopRight' as const, fill: CHART_CHROME.referenceText, fontSize: 11 },
  };
}

