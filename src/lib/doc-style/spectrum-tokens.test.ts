// @vitest-environment node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import tokens from '../../../docs/design/design-tokens.json';
import { SPECTRUM_FONTS, SPECTRUM_HEX } from './spectrum-tokens';

/** The generated palette must match docs/design/design-tokens.json; rerun the script when it drifts. */
describe('spectrum-tokens.ts', () => {
  it('is what scripts/design-tokens-docs.mjs prints today', () => {
    const printed = execFileSync(process.execPath, [path.join(process.cwd(), 'scripts/design-tokens-docs.mjs')], { encoding: 'utf8' });
    expect(fs.readFileSync(path.join(__dirname, 'spectrum-tokens.ts'), 'utf8')).toBe(printed);
  });

  it('carries the light-theme ink and brand and the token fonts', () => {
    const light = (name: string) => tokens.color.tokens.find((t) => t.name === name)?.value as { light: string };
    expect(SPECTRUM_HEX.ink).toBe(light('ink').light);
    expect(SPECTRUM_HEX.brand).toBe(light('brand').light);
    expect(SPECTRUM_HEX.rule).toBe(SPECTRUM_HEX.ink);
    expect(SPECTRUM_FONTS.ui).toBe(tokens.type.fonts.find((f) => f.family === 'ui')?.name);
    expect(SPECTRUM_FONTS.mono).toBe(tokens.type.fonts.find((f) => f.family === 'mono')?.name);
  });
});
