/**
 * OFFLINE FILL — runs a recipe against a page that is already in a document (a captured MCA page,
 * or the sanitized fixture), with the real scanner, heal ladder (T0 and T1 only, no AI), guards and
 * filler, and reports what happened to every field. No run engine, no Suite, no click: it answers
 * "does this recipe still bind to this capture?" offline.
 *
 * Used by `offline.test.ts` (jsdom, part of `npm test`) and by `tools/offline/run-offline.mjs`
 * (Playwright, real Chromium, against captures placed in a local folder).
 */
import { expandRecipe } from '../engine/expand';
import { valueFor } from '../engine/values';
import { globMatch } from '../engine/url';
import { resolveField } from '../heal/ladder';
import { placeholderReason } from '../guards';
import { PortalAgent } from '../portal/agent';
import { scanDocument } from '../portal/scanner';
import type { GuardCode, HealTier, Recipe } from '../shared/types';

export type OfflineStatus = 'filled' | 'missing' | 'placeholder' | 'user' | 'refused' | 'notfound' | 'hidden' | 'noinstance' | 'failed';

export interface OfflineRow {
  key: string;
  label: string;
  status: OfflineStatus;
  tier?: HealTier;
  reason?: string;
}

export interface OfflineReport {
  recipeId: string;
  pages: string[];
  rows: OfflineRow[];
  /** Visible controls the guards refused (login, password, captcha, OTP), by label. Never filled. */
  refusedControls: Array<{ label: string; code: GuardCode }>;
}

/** The recipe pages whose URL pattern matches this path (real MCA path or mock path). */
export function pagesForPath(recipe: Recipe, path: string): string[] {
  return recipe.pages.filter((p) => globMatch(p.urlPattern, path) || (p.mockUrlPattern ? globMatch(p.mockUrlPattern, path) : false)).map((p) => p.id);
}

export async function offlineFill(doc: Document, recipe: Recipe, profile: Record<string, unknown>, pageIds?: string[]): Promise<OfflineReport> {
  const expanded = expandRecipe(recipe, profile);
  const pages = expanded.pages.filter((p) => !pageIds || pageIds.includes(p.id));
  const agent = new PortalAgent(doc);
  const rows: OfflineRow[] = [];
  const refusedControls: OfflineReport['refusedControls'] = [];
  for (const page of pages) {
    const scan = scanDocument(doc, { probes: page.fields.map((f) => ({ key: f.key, som: f.som, css: f.css, nth: f.nth, nodeId: f.nodeId })) });
    for (const f of scan.fields) if (f.refused && f.visible && !refusedControls.some((r) => r.label === (f.label || f.name))) refusedControls.push({ label: f.label || f.name, code: f.refused.code });
    const claimed = new Set<string>();
    for (const field of page.fields) {
      const row = { key: field.key, label: field.label };
      if (field.askUser) {
        rows.push({ ...row, status: 'user' });
        continue;
      }
      const value = valueFor(profile, field);
      if (value == null) {
        rows.push({ ...row, status: 'missing' });
        continue;
      }
      const hit = placeholderReason(value, undefined);
      if (hit) {
        rows.push({ ...row, status: 'placeholder', reason: hit.why });
        continue;
      }
      const r = await resolveField(field, scan, { claimed, allowAi: false });
      if (!r.found) {
        if ('notHere' in r) rows.push({ ...row, status: r.notHere, reason: r.reason });
        else if ('refused' in r) rows.push({ ...row, status: 'refused', reason: r.refused.reason });
        else rows.push({ ...row, status: 'notfound', reason: r.reason });
        continue;
      }
      claimed.add(r.candidate.uid);
      const res = await agent.fill({ uid: r.candidate.uid, som: r.candidate.som, css: r.candidate.css, name: r.candidate.name }, value, false, { optionsMs: 0 });
      rows.push(res.ok ? { ...row, status: 'filled', tier: r.tier } : { ...row, status: res.refused ? 'refused' : 'failed', tier: r.tier, reason: res.reason });
    }
  }
  agent.overlay.clear();
  return { recipeId: recipe.id, pages: pages.map((p) => p.id), rows, refusedControls };
}
