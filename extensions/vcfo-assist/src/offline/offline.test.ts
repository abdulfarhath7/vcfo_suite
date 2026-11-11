/**
 * OFFLINE FILLER against captured pages (the old repository's tools/test_filler.js, ported).
 *
 * 1. The committed, sanitized fixtures (`tools/offline/fixtures/*.html`, rebuilt from the captured
 *    schemas with the real node ids, names, labels and option lists, and no values): every recipe
 *    binds at T0 by the real MCA key, every bound field lands, the guards refuse the OTP boxes, and
 *    nothing is clicked.
 * 2. Real captures, when a person has placed some in a local folder (`VCFO_CAPTURES_DIR`, default
 *    `captures/` beside this package; both git-ignored): each `page.html` (with the recorder's
 *    `meta.json` beside it) or `*.html` carrying `<meta name="vcfo-capture-url">` is filled the same
 *    way and the report printed. Skipped when there are none.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { BUNDLED_RECIPES } from '../recipes';
import { normalizeRecipe } from '../recipes/normalize';
import { PART_B_PROFILE } from '../test/mock-env';
import { offlineFill, pagesForPath, type OfflineReport } from './offline-fill';
import type { Recipe } from '../shared/types';

const FIXTURES = path.resolve(__dirname, '../../tools/offline/fixtures');
const CAPTURES = process.env.VCFO_CAPTURES_DIR ?? path.resolve(__dirname, '../../captures');

/** One sample client covering every MCA recipe (sentinel values only). */
const PROFILE: Record<string, unknown> = {
  ...(PART_B_PROFILE.profile as Record<string, unknown>),
  agile: { numberOfDirectors: 3 },
  moa: { witness: { name: 'Sentinel Witness', address: 'Sentinel Lane, Hyderabad' } },
  aoa: { witness: { name: 'Sentinel Witness', addressDescriptionOccupation: 'Sentinel Lane, Hyderabad; Chartered Accountant', dinPanMembership: 'M-0000' } },
  subscribers: (PART_B_PROFILE.profile.subscribers as Array<Record<string, unknown>>).map((s) => ({ ...s, place: 'Hyderabad' })),
};
const RECIPES: Recipe[] = Object.values(BUNDLED_RECIPES).map((s) => normalizeRecipe(s.recipe));

function load(html: string, url: string) {
  const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html;
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/gi, '');
  window.history.replaceState(null, '', new URL(url).pathname);
}

async function fillCapture(html: string, url: string): Promise<OfflineReport[]> {
  load(html, url);
  const out: OfflineReport[] = [];
  for (const recipe of RECIPES) {
    const pages = pagesForPath(recipe, new URL(url).pathname);
    if (pages.length) out.push(await offlineFill(document, recipe, PROFILE, pages));
  }
  return out;
}

const urlOf = (html: string) => /<meta name="vcfo-capture-url" content="([^"]+)"/.exec(html)?.[1] ?? '';
const by = (r: OfflineReport, status: string) => r.rows.filter((x) => x.status === status).map((x) => x.key);

describe('offline filler on the sanitized captured fixtures', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('SPICe+ Part A: every bound field lands at T0 by its real key; the uncaptured questions stay the user\'s', async () => {
    const html = readFileSync(path.join(FIXTURES, 'spice-part-a.html'), 'utf8');
    const [report] = await fillCapture(html, urlOf(html));
    expect(report!.recipeId).toBe('spice-a');
    expect(by(report!, 'filled').sort()).toEqual(['company.category', 'company.class', 'company.nicCode', 'company.proposedNames[0]', 'company.proposedNames[1]', 'company.subCategory', 'company.type'].sort());
    expect(report!.rows.filter((r) => r.status === 'filled').every((r) => r.tier === 'T0')).toBe(true);
    expect(by(report!, 'user').sort()).toEqual(['company.nameSignificance', 'company.trademarkSimilar']);
    const v = (key: string) => (document.querySelector(`.guideFieldNode.${key} input, .guideFieldNode.${key} select`) as HTMLInputElement).value;
    expect(v('proposedname1')).toBe('Sentinel Alpha Private Limited');
    expect(v('type-of-company')).toBe('New Company (Others)');
    expect(v('class-of-company')).toBe('Private');
    // The hidden system field named userId is never touched.
    expect(v('userId')).toBe('');
  });

  it('SPICe+ Part B: the open blocks fill at T0, the others are left as "open the Add/Edit panel", and OTP boxes are refused', async () => {
    const html = readFileSync(path.join(FIXTURES, 'spice-part-b.html'), 'utf8');
    const [report] = await fillCapture(html, urlOf(html));
    expect(report!.pages).toEqual(['structure', 'address', 'subscribers', 'directors']);
    const filled = by(report!, 'filled');
    for (const key of ['company.capital.equity.authorizedShares', 'registeredOffice.line1', 'registeredOffice.pincode', 'registeredOffice.area', 'registeredOffice.email', 'subscribers[0].firstName@6c', 'subscribers[0].pan@6c', 'directors[0].din@7a', 'subscribers[0].firstName@7b']) {
      expect(filled, key).toContain(key);
    }
    // The capture shows one sub-panel per block: the second person's block is not open.
    expect(by(report!, 'noinstance')).toEqual(expect.arrayContaining(['subscribers[1].firstName@6c', 'directors[1].firstName@7b']));
    expect(report!.rows.filter((r) => ['failed', 'refused', 'notfound'].includes(r.status))).toEqual([]);
    expect(report!.rows.filter((r) => r.status === 'filled').every((r) => r.tier === 'T0')).toBe(true);
    expect(report!.refusedControls.map((r) => r.code)).toContain('G3');
  });

  it.each([
    ['agile-pro-s', 'agile-pro-s', ['registeredOffice.state', 'registeredOffice.district', 'agile.numberOfDirectors', 'registeredOffice.city']],
    ['inc-33-emoa', 'emoa', ['company.proposedNames[0]', 'registeredOffice.state', 'moa.witness.name', 'moa.witness.address']],
    ['inc-34-eaoa', 'eaoa', ['company.proposedNames[0]', 'subscribers[0].place', 'subscribers[1].place', 'aoa.witness.name', 'aoa.witness.addressDescriptionOccupation', 'aoa.witness.dinPanMembership']],
  ])('%s: every bound field lands at T0', async (form, recipeId, keys) => {
    const html = readFileSync(path.join(FIXTURES, `${form}.html`), 'utf8');
    const [report] = await fillCapture(html, urlOf(html));
    expect(report!.recipeId).toBe(recipeId);
    expect(by(report!, 'filled').sort()).toEqual([...keys].sort());
    expect(report!.rows.filter((r) => r.status === 'filled').every((r) => r.tier === 'T0')).toBe(true);
  });

  it('AGILE-PRO-S: the OTP boxes are refused (G3) and stay empty', async () => {
    const html = readFileSync(path.join(FIXTURES, 'agile-pro-s.html'), 'utf8');
    const [report] = await fillCapture(html, urlOf(html));
    expect(report!.refusedControls).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'G3' })]));
    for (const key of ['MobileOTP', 'EmailOTP']) expect((document.querySelector(`.guideFieldNode.${key} input`) as HTMLInputElement).value).toBe('');
  });

  it('the fixtures hold no PAN, Aadhaar, DIN, email or mobile shaped value', () => {
    for (const file of readdirSync(FIXTURES)) {
      const text = readFileSync(path.join(FIXTURES, file), 'utf8').replace(/<[^>]+>/g, ' ');
      expect(text, file).not.toMatch(/\b[A-Z]{5}\d{4}[A-Z]\b|\b\d{4}\s?\d{4}\s?\d{4}\b|\b\d{8}\b|[\w.+-]+@[\w-]+\.[a-z]{2,}|\b[6-9]\d{9}\b/);
    }
  });
});

/** Every captured page under the local folder: the recorder's `<step>/page.html` (+ meta.json), or a saved `*.html`. */
function localCaptures(dir: string): Array<{ file: string; url: string }> {
  if (!existsSync(dir)) return [];
  const out: Array<{ file: string; url: string }> = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = path.join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.html') && !name.startsWith('frame-')) {
        const meta = path.join(path.dirname(p), 'meta.json');
        const url = existsSync(meta) ? String((JSON.parse(readFileSync(meta, 'utf8')) as { url?: string }).url ?? '') : urlOf(readFileSync(p, 'utf8'));
        if (/^https?:/.test(url)) out.push({ file: p, url });
      }
    }
  };
  walk(dir);
  return out;
}

const captures = localCaptures(CAPTURES);
describe.skipIf(!captures.length)(`offline filler on local captures (${CAPTURES})`, () => {
  it.each(captures.map((c) => [path.relative(CAPTURES, c.file), c] as const))('%s', async (_name, c) => {
    const reports = await fillCapture(readFileSync(c.file, 'utf8'), c.url);
    for (const r of reports) {
      const counts = r.rows.reduce<Record<string, number>>((m, x) => ({ ...m, [x.status]: (m[x.status] ?? 0) + 1 }), {});
      console.log(`${r.recipeId} [${r.pages.join(', ')}] ${JSON.stringify(counts)}`);
      for (const x of r.rows.filter((row) => row.status !== 'filled')) console.log(`   [${x.status}] ${x.key}${x.reason ? `: ${x.reason}` : ''}`);
      expect(r.rows.filter((x) => x.status === 'refused' && x.tier)).toEqual([]);
    }
  });
});
