import type { Recipe } from './recipe';

/**
 * The mock portal pages and the recipes they stand in for. The mocks carry the REAL MCA field keys
 * (the semantic class on `.guideFieldNode`, from the captures in
 * `extensions/vcfo-assist/portal-data/mca-v3/`), so the extension's tests and e2e run the real
 * selectors. `extensions/vcfo-assist/src/recipes/recipes.test.ts` fails when a mock page stops
 * carrying a key one of these recipes uses. The drift page renames one key on purpose.
 */
export const MOCK_PAGES = {
  'spice-a.html': 'spice-a',
  'spice-b.html': 'spice-b',
} as const;

/** `.guideFieldNode.proposedname1` → `proposedname1`: the MCA semantic key in a recipe selector. */
export function guideKeyOf(css: string | undefined): string | null {
  const m = /^\.guideFieldNode\.([A-Za-z_][\w-]*)$/.exec((css ?? '').trim());
  return m?.[1] ?? null;
}

/** Every MCA key a recipe's fields find their control by, once each, in recipe order. */
export function guideKeysOf(recipe: Pick<Recipe, 'fields'>): string[] {
  return [...new Set(recipe.fields.map((f) => guideKeyOf(f.css)).filter((k): k is string => Boolean(k)))];
}
