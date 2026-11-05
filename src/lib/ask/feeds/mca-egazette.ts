import 'server-only';

import { withBrowserPage, type BrowserPage } from './browser-fetch';
import { pdfContent } from './govt-fetch';
import { govtGetBytes } from './govt-https';
import { toYmd, type FeedContent, type FeedItem, type FeedWatcher } from './types';

/**
 * MCA (Ministry of Corporate Affairs) — through the Gazette of India.
 *
 * mca.gov.in refuses every program and headless Chrome ("Access Denied",
 * checked 2026-10-23/24). Every MCA notification is, by law, published in
 * the Gazette of India, and egazette.gov.in lets you search "by Ministry"
 * for a month: a table of subject, issue date, gazette id and a PDF. The
 * search is a click-through on ASP.NET pages whose session lives in the URL
 * (direct links die), so it runs in a real browser (`browser-fetch.ts`).
 * The PDF itself is served by id without a session:
 *   https://egazette.gov.in/WriteReadData/<year>/<serial>.pdf
 *
 * Each check searches the current month, and the previous month too during
 * the first week (a notification issued on the 30th is often published on
 * the 2nd). Items about the ministry's own staff — service rules, tenure of
 * officers, appointments — are skipped: a client never needs them.
 */
const HOME_URL = 'https://egazette.gov.in/';
const MINISTRY = 'Ministry of Corporate Affairs';

const INTERNAL_MATTERS = /service rules|tenure|appoint|officiating|recruitment|cadre|promotion|transfer of|deputation|pay scale/i;

export interface GazetteRow {
  subject: string;
  /** "12-Oct-2026" as the table shows it. */
  issueDate: string;
  /** "CG-DL-E-13102026-277096" */
  gazetteId: string;
}

/** "CG-DL-E-13102026-277096" → { year: 2026, serial: 277096 } (publish day is in the id). */
export function gazettePdfUrl(gazetteId: string): string | null {
  const m = /-(\d{2})(\d{2})(\d{4})-(\d+)$/.exec(gazetteId.trim());
  if (!m) return null;
  return `https://egazette.gov.in/WriteReadData/${m[3]}/${m[4]}.pdf`;
}

/** The subject cell carries "(New Gazette, Impacted Rule : …, Impact : Actionable)" after the title; keep the title. */
export function gazetteTitle(subject: string): string {
  return subject.replace(/\s*\(New Gazette[\s\S]*$/i, '').replace(/\s+/g, ' ').trim();
}

/** Pure: table rows → feed items, skipping the ministry's internal staff matters. */
export function parseGazetteRows(rows: readonly GazetteRow[]): FeedItem[] {
  const out: FeedItem[] = [];
  for (const row of rows) {
    const publicUrl = gazettePdfUrl(row.gazetteId);
    const publishedAt = toYmd(row.issueDate.trim());
    const title = gazetteTitle(row.subject);
    if (!publicUrl || !publishedAt || !title) continue;
    if (INTERNAL_MATTERS.test(title)) continue;
    out.push({
      externalId: row.gazetteId.trim(),
      number: null,
      title: `MCA gazette notification · ${title}`.slice(0, 300),
      kind: 'Gazette notification',
      publishedAt,
      publicUrl,
    });
  }
  return out;
}

/** Months to search: this one, plus the previous during the first week. */
export function monthsToSearch(now = new Date()): Array<{ month: number; year: number }> {
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();
  const list = [{ month, year }];
  if (now.getUTCDate() <= 7) list.push(month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year });
  return list;
}

/** One postback step: do `action`, wait for the page to reload, settle. */
async function step(page: BrowserPage, action: () => Promise<unknown>): Promise<void> {
  await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 30_000 }).catch(() => undefined), action()]);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(1500);
}

/** The ministry search for one month, read from the results table. */
async function searchMonth(page: BrowserPage, month: number, year: number): Promise<GazetteRow[]> {
  await page.goto(HOME_URL, { waitUntil: 'networkidle', timeout: 60_000 });
  await step(page, () => page.locator("a[href*=\"__doPostBack('sgzt'\"]").first().click());
  await step(page, () => page.locator('#btnMinistry').click());
  await step(page, () => page.selectOption('#ddlMinistry', { label: MINISTRY }));
  await step(page, () => page.selectOption('#ddlmonth', String(month)));
  await step(page, () => page.selectOption('#ddlyear', String(year)));
  await step(page, () => page.locator('#ImgSubmitDetails').click());
  // Columns: S.No · Ministry · Department · Office · Subject · Category · Part & Section · Issue Date · Publish Date · Gazette ID · Download
  return page.locator('table tr').evaluateAll((trs) =>
    trs
      .map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent ?? '').replace(/\s+/g, ' ').trim()))
      .filter((c) => c.length >= 10 && /^CG-/.test(c[9] ?? ''))
      .map((c) => ({ subject: c[4] ?? '', issueDate: c[7] ?? '', gazetteId: c[9] ?? '' })),
  );
}

export const mcaGazetteWatcher: FeedWatcher = {
  id: 'mca-egazette',
  label: 'MCA · notifications as published in the Gazette of India (egazette.gov.in)',
  act: 'Companies Act',
  homeUrl: HOME_URL,
  async list() {
    const rows = await withBrowserPage(async (page) => {
      const all: GazetteRow[] = [];
      for (const { month, year } of monthsToSearch()) {
        const rows = await searchMonth(page, month, year);
        console.info(`[ask-feeds] e-Gazette ${MINISTRY} ${year}-${String(month).padStart(2, '0')}: ${rows.length} gazette(s) listed`);
        all.push(...rows);
      }
      return all;
    });
    return parseGazetteRows(rows);
  },
  async fetch(item: FeedItem): Promise<FeedContent> {
    // egazette.gov.in sends an incomplete certificate chain; `govtGetBytes` supplies the missing pieces.
    const res = await govtGetBytes(item.publicUrl, 90_000);
    if (res.status !== 200) throw new Error(`egazette.gov.in answered ${res.status} for the file`);
    return pdfContent(res.body, `${item.externalId}.pdf`);
  },
};
