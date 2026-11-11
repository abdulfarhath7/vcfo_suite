/**
 * Repeating groups. A recipe field with `each: 'directors'` is a template (`directors[{i}].din`);
 * once the profile is loaded the engine turns it into one field per entry of that profile array,
 * replacing `{i}` (0-based) and `{n}` (1-based) in the key, SOM path, CSS selector and label. The
 * profile alone decides how many blocks are filled; an empty or absent array fills none. The
 * expanded recipe is what the run saves, so a restored run fills exactly what it planned.
 *
 * Two additions for the real MCA forms (captured AEM keys such as `.guideFieldNode.din7a`):
 *  - `where` keeps only the entries whose values pass (Part B: subscribers with a DIN fill block 6b,
 *    those without fill 6c).
 *  - `nth`: every expanded entry takes the next match of its CSS selector on the page, counted per
 *    selector in recipe order, starting at the template's `nth`. So subscriber-directors take the
 *    first director blocks (7a, 7b) and directors who are not subscribers take the ones after.
 */
import { getPath } from './values';
import { nameFromCss, nameFromSom } from '../recipes/normalize';
import type { Recipe, RecipeField } from '../shared/types';

/** No portal form repeats a block this often; a larger array is cut, never looped over blindly. */
export const MAX_REPEAT = 20;

const present = (v: unknown): boolean => v !== undefined && v !== null && v !== '' && v !== false && !(typeof v === 'number' && !Number.isFinite(v));

/** True when one profile entry passes a template's `where`. */
export function entryMatches(entry: unknown, where: RecipeField['where']): boolean {
  if (!where) return true;
  return Object.entries(where).every(([path, want]) => {
    const v = getPath(entry, path);
    if (want === true) return present(v);
    if (want === false) return !present(v);
    return String(v ?? '') === want;
  });
}

function instance(field: RecipeField, i: number, nth: number | undefined): RecipeField {
  const fill = (t: string | undefined) => t?.replace(/\{i\}/g, String(i)).replace(/\{n\}/g, String(i + 1));
  const { each: _each, where: _where, ...rest } = field;
  const som = fill(field.som);
  const css = fill(field.css);
  return {
    ...rest,
    key: fill(field.key)!,
    path: fill(field.path),
    label: fill(field.label)!,
    som,
    css,
    nth,
    // The captured node id names the first block only, so it is not used for repeated blocks.
    nodeId: i === 0 && nth === (field.nth ?? 0) ? field.nodeId : undefined,
    name: nameFromCss(css) ?? nameFromSom(som),
  };
}

/** How many entries the profile holds for one `each` array. */
export function repeatCount(profile: unknown, each: string): number {
  const list = getPath(profile, each);
  return Array.isArray(list) ? Math.min(list.length, MAX_REPEAT) : 0;
}

export function expandFields(fields: RecipeField[], profile: unknown): RecipeField[] {
  // Templates of one group stay together, instance by instance: director 1's fields, then director 2's.
  const out: RecipeField[] = [];
  const done = new Set<string>();
  /** Per selector: how many expanded entries already took a match. */
  const taken = new Map<string, number>();
  for (const field of fields) {
    if (!field.each) {
      out.push(field);
      continue;
    }
    if (done.has(field.each)) continue;
    done.add(field.each);
    const group = fields.filter((f) => f.each === field.each);
    const list = getPath(profile, field.each);
    for (let i = 0; i < repeatCount(profile, field.each); i += 1) {
      const entry = Array.isArray(list) ? list[i] : undefined;
      for (const f of group) {
        if (!entryMatches(entry, f.where)) continue;
        let nth: number | undefined;
        if (f.nth !== undefined && f.css) {
          const counter = `${f.css}|${f.nth}`;
          const k = taken.get(counter) ?? 0;
          taken.set(counter, k + 1);
          nth = f.nth + k;
        }
        out.push(instance(f, i, nth));
      }
    }
  }
  return out;
}

export function expandRecipe(recipe: Recipe, profile: unknown): Recipe {
  return { ...recipe, pages: recipe.pages.map((p) => ({ ...p, fields: expandFields(p.fields, profile) })) };
}

/** True when the recipe still has templates (the profile has not been applied yet). */
export function hasTemplates(recipe: Recipe): boolean {
  return recipe.pages.some((p) => p.fields.some((f) => f.each));
}
