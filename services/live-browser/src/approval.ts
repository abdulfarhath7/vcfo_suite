/**
 * G13 in the live browser. The user's "Fill now" on the "Before I fill" screen is the approval:
 * it covers the values Suite held for the form's fields at that moment, minus the fields the user
 * said they will type on the portal. The broker turns it into a table of field key → SHA-256 of
 * the value, using the engine's own `valueFor` over the same recipe and profile the engine gets,
 * so the two can never disagree about what a value is.
 *
 * When the engine stops at a page's confirm table, the page is filled without a further click
 * only when every planned field is in the approval with the same value and was found by the
 * recipe itself or by a deterministic label match (T0 or T1). A field found by the AI (T3) or by
 * teach mode (T4), a value that changed, or a field outside the approval waits for the person.
 */
import { createHash } from 'node:crypto';
import { valueFor, getPath } from '../../../extensions/vcfo-assist/src/engine/values';
import { expandRecipe, hasTemplates } from '../../../extensions/vcfo-assist/src/engine/expand';
import { normalizeRecipe } from '../../../extensions/vcfo-assist/src/recipes/normalize';
import type { FieldOutcome, Recipe } from '../../../extensions/vcfo-assist/src/shared/types';

export const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

export type Approval = ReadonlyMap<string, string>;

/** Profile paths of the fields the user will type on the portal, removed so the engine leaves and marks them (G16). */
export function withoutTypeOnPortal(profile: Record<string, unknown>, recipe: Recipe, keys: readonly string[] | undefined): Record<string, unknown> {
  if (!keys?.length) return profile;
  const copy = structuredClone(profile);
  const fields = recipe.pages.flatMap((p) => p.fields);
  for (const key of keys) {
    const field = fields.find((f) => f.key === key);
    const path = (field?.path ?? key).replace(/\[(\d+)\]/g, '.$1').split('.');
    const leaf = path.pop();
    const parent = getPath(copy, path.join('.'));
    if (leaf && parent && typeof parent === 'object') delete (parent as Record<string, unknown>)[leaf];
  }
  return copy;
}

/** The approval table from the signed recipe body and the profile the engine will use. */
export function buildApproval(rawRecipe: unknown, profile: Record<string, unknown>, approvedKeys?: readonly string[]): Approval {
  let recipe = normalizeRecipe(rawRecipe as Recipe);
  if (hasTemplates(recipe)) recipe = expandRecipe(recipe, profile);
  const only = approvedKeys ? new Set(approvedKeys) : null;
  const out = new Map<string, string>();
  for (const page of recipe.pages) {
    for (const field of page.fields) {
      if (field.askUser) continue;
      if (only && !only.has(field.key)) continue;
      const value = valueFor(profile, field);
      if (value != null) out.set(field.key, sha256(value));
    }
  }
  return out;
}

/** Null when the planned fields are covered; otherwise the labels that need the person's confirmation. */
export function unapproved(planned: readonly FieldOutcome[], approval: Approval): string[] | null {
  const out: string[] = [];
  for (const f of planned) {
    if (f.status !== 'planned') continue;
    const ok = f.value != null && approval.get(f.key) === sha256(f.value) && (f.tier === 'T0' || f.tier === 'T1');
    if (!ok) out.push(f.label);
  }
  return out.length ? out : null;
}
