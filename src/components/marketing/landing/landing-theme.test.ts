import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** LP-01: both landing palettes pass WCAG AA for the text and control pairs the page uses. */
const css = readFileSync(join(__dirname, 'landing.css'), 'utf8');

function tokens(selectorStart: string): Record<string, string> {
  const start = css.indexOf(selectorStart);
  const block = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries([...block.matchAll(/--lp-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** [text, background] pairs; every one is body-size text or a control label. */
const PAIRS: Array<[string, string]> = [
  ['ink', 'surface'], ['ink', 'raised'], ['ink-muted', 'surface'], ['ink-muted', 'raised'], ['ink-faint', 'raised'], ['ink-faint', 'surface'],
  ['brand', 'surface'], ['brand', 'raised'], ['on-brand', 'brand'], ['brand', 'brand-soft'],
  ['positive', 'positive-soft'], ['warning', 'warning-soft'], ['danger', 'danger-soft'], ['highlight', 'highlight-soft'], ['info', 'info-soft'],
  ['highlight', 'surface'], ['ink-muted', 'sunken'],
];

describe.each([
  ['light', '.lp { --lp-surface'],
  ['dark', 'html[data-lp-theme="dark"] .lp {'],
])('the %s landing theme', (_name, selector) => {
  const t = tokens(selector);
  it.each(PAIRS)('%s on %s is at least 4.5:1', (fg, bg) => {
    expect(t[fg], `--lp-${fg}`).toBeTruthy();
    expect(t[bg], `--lp-${bg}`).toBeTruthy();
    expect(contrast(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(4.5);
  });
});
