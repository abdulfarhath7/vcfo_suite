/**
 * One recipe source. The bundled recipes are generated from Suite's registry
 * (`src/lib/assist-agents/recipes/*.json`) by Suite's `scripts/assist-recipes-bundle.ts`; this test
 * fails when they drift, when the dev key here differs from the one Suite signs with, or when a mock
 * page stops carrying the field names Suite's recipes are built from (`mock-fields.ts`). Skipped
 * when the extension is built outside the Suite repository; excluded from this package's `tsc`
 * because it imports Suite's sources.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import bundle from './bundled.json';
import { RECIPE_PUBLIC_KEYS, canonicalJson, verifySignature } from '../engine/recipe';

const SUITE_RECIPES = path.resolve(__dirname, '../../../../src/lib/assist-agents/recipes');
const MOCK_DIR = path.resolve(__dirname, '../../mock-portal');
const present = existsSync(SUITE_RECIPES);

describe('bundled recipes', () => {
  it('ship the dev key the extension trusts, and every bundled recipe verifies with it', async () => {
    expect(bundle.devPublicKey).toBe(RECIPE_PUBLIC_KEYS.dev);
    for (const signed of Object.values(bundle.recipes)) expect((await verifySignature(signed, 'localhost')).ok).toBe(true);
  });
});

describe.skipIf(!present)("bundled recipes match Suite's registry", async () => {
  const registry = await import('../../../../src/lib/assist-agents/registry');
  const mockFields = await import('../../../../src/lib/assist-agents/mock-fields');
  const files = present ? readdirSync(SUITE_RECIPES).filter((f) => f.endsWith('.json')) : [];

  it("holds exactly Suite's recipes with their packs applied, byte for byte (rerun scripts/assist-recipes-bundle.ts in Suite)", () => {
    const ids = files.map((f) => (JSON.parse(readFileSync(path.join(SUITE_RECIPES, f), 'utf8')) as { id: string }).id);
    expect(Object.keys(bundle.recipes).sort()).toEqual(ids.sort());
    for (const [id, signed] of Object.entries(bundle.recipes)) {
      expect(canonicalJson(signed.recipe), id).toBe(canonicalJson(registry.getRecipe(id)));
    }
  });

  it('mock pages carry every real MCA key the recipes find their fields by (except the drift and unverified ones)', () => {
    for (const [file, recipeId] of Object.entries(mockFields.MOCK_PAGES)) {
      const html = readFileSync(path.join(MOCK_DIR, file), 'utf8');
      const recipe = registry.getRecipe(recipeId)!;
      for (const key of mockFields.guideKeysOf(recipe)) expect(html, `${file} ${key}`).toMatch(new RegExp(`class="guideFieldNode [A-Za-z]+ ${key}"`));
      expect(html).toContain('id="guideContainer-rootPanel__"');
      expect(html).toContain('id="okInfoModalBtn"');
    }
    expect(readFileSync(path.join(MOCK_DIR, 'spice-b.html'), 'utf8')).toContain('class="listep');
    // The drift page renames proposedname2 so the run must heal it.
    expect(readFileSync(path.join(MOCK_DIR, 'spice-a-drift.html'), 'utf8')).not.toContain(' proposedname2"');
  });

  it('mock pages hold no PAN, Aadhaar, DIN, email or mobile shaped text', () => {
    for (const file of ['spice-a.html', 'spice-a-drift.html', 'spice-b.html']) {
      const text = readFileSync(path.join(MOCK_DIR, file), 'utf8').replace(/<[^>]+>/g, ' ');
      expect(text, file).not.toMatch(/\b[A-Z]{5}\d{4}[A-Z]\b|\b\d{4}\s?\d{4}\s?\d{4}\b|\b\d{8}\b|[\w.+-]+@[\w-]+\.[a-z]{2,}|\b[6-9]\d{9}\b/);
    }
  });
});
