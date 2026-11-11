/**
 * Drift test: src/ui/spectrum-tokens.css must be exactly what scripts/tokens.mjs makes from
 * Suite's docs/design/design-tokens.json. Run `node scripts/tokens.mjs` after a token change.
 * It also checks that the panel's stylesheets use only tokens for colour and font.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { TOKENS_CSS, expectedCss } from '../../scripts/tokens.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);

describe('spectrum tokens', () => {
  it('spectrum-tokens.css matches design-tokens.json', () => {
    expect(readFileSync(TOKENS_CSS, 'utf8')).toBe(expectedCss());
  });

  it('has a dark value for the themed colours', () => {
    const css = readFileSync(TOKENS_CSS, 'utf8');
    const dark = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'));
    for (const name of ['surface', 'surface-raised', 'ink', 'brand', 'positive', 'waiting', 'hero-gradient']) expect(dark).toContain(`--${name}:`);
  });

  it('panel.css has no literal colours, fonts or dashed edges', () => {
    const css = readFileSync(path.join(here, 'panel.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|oklch\(|hsl\(/i);
    expect(css).not.toMatch(/font-family:(?!\s*var\()/i);
    expect(css).not.toMatch(/\b(dashed|dotted)\b/);
  });
});
