import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildEmailTokens,
  oklchToHex,
  renderEmailTokensModule,
} from '../../../scripts/design-tokens-email.mjs';
import { SPECTRUM_EMAIL_COLORS } from './spectrum-email-tokens';

const root = path.resolve(__dirname, '../../..');
const json = JSON.parse(readFileSync(path.join(root, 'docs/design/design-tokens.json'), 'utf8'));

describe('spectrum-email-tokens.ts', () => {
  it('matches docs/design/design-tokens.json (run npm run tokens:email after a token change)', () => {
    const generated = renderEmailTokensModule(buildEmailTokens(json));
    const onDisk = readFileSync(path.join(root, 'src/lib/email/spectrum-email-tokens.ts'), 'utf8');
    expect(onDisk).toBe(generated);
  });

  it('converts oklch to the design hex within rounding', () => {
    const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    for (const token of json.color.tokens) {
      if (!token.oklch) continue;
      for (const mode of ['light', 'dark'] as const) {
        const got = channels(oklchToHex(token.oklch[mode]));
        const want = channels(token.value[mode]);
        const drift = Math.max(...got.map((v, i) => Math.abs(v - want[i])));
        expect(drift, `${token.name} ${mode}`).toBeLessThanOrEqual(3);
      }
    }
  });

  it('resolves aliases such as rule → ink', () => {
    expect(SPECTRUM_EMAIL_COLORS.light.rule).toBe(SPECTRUM_EMAIL_COLORS.light.ink);
    expect(SPECTRUM_EMAIL_COLORS.dark.rule).toBe(SPECTRUM_EMAIL_COLORS.dark.ink);
  });
});
