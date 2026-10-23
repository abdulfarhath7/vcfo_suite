import 'server-only';

import { govtGetText } from './govt-https';
import { toYmd, type FeedContent, type FeedItem, type FeedWatcher } from './types';

/**
 * CBIC Tax Information Portal — the Central Board of Indirect Taxes publishes
 * every GST notification and circular here (the legal instrument itself; the
 * GST portal's "News and Updates" page sits behind a browser-only check, so
 * we read the law at its source instead).
 *
 * Found 2026-10-22 by watching what the site's own page loads:
 *   GET /api/cbic-notification-msts/fetchUpdatesByTaxId/1000001   → latest GST updates (JSON)
 *   GET /api/cbic-notification-msts/download/{id}/ENG              → { data: <base64 PDF>, fileName }
 *   GET /api/cbic-circular-msts/download/{id}/ENG                  → same, for circulars
 * 1000001 is GST's tax id on this portal. These are the portal's internal
 * endpoints, not a published API: if CBIC changes them, this watcher fails
 * loudly (the Sources page shows the error) and nothing else breaks.
 */
const BASE = 'https://taxinformation.cbic.gov.in';
export const CBIC_GST_TAX_ID = 1000001;

export interface CbicUpdateRow {
  id: number;
  updatedDate: string;
  notificationNo: string | null;
  notificationName: string | null;
  notificationNameToBeDisplay?: string | null;
  updateType: string | null;
  updateCategory: string | null;
}

/** Pure: CBIC's JSON rows → feed items. Rows without an id or a date are dropped. */
export function parseCbicUpdates(rows: unknown): FeedItem[] {
  if (!Array.isArray(rows)) return [];
  const out: FeedItem[] = [];
  for (const raw of rows as CbicUpdateRow[]) {
    if (!raw || typeof raw.id !== 'number') continue;
    const publishedAt = toYmd(raw.updatedDate);
    if (!publishedAt) continue;
    const kind = raw.updateType?.trim() || 'Notification';
    const name = (raw.notificationName || raw.notificationNameToBeDisplay || '').replace(/\s+/g, ' ').trim();
    const number = raw.notificationNo?.trim() || null;
    out.push({
      // Notifications and circulars are separate tables on CBIC; ids may collide.
      externalId: `${kind.toLowerCase()}:${raw.id}`,
      number,
      title: [number ? `${kind} ${number}` : kind, raw.updateCategory?.trim(), name].filter(Boolean).join(' · ').slice(0, 300),
      kind,
      publishedAt,
      publicUrl: `${BASE}/content-page/explore-notification`,
    });
  }
  return out;
}

/** CBIC sends an incomplete certificate chain; `govtGetText` supplies the missing intermediate. */
async function getJson(url: string): Promise<unknown> {
  const res = await govtGetText(url, 45_000);
  if (res.status < 200 || res.status >= 300) throw new Error(`CBIC answered ${res.status} for ${url.replace(BASE, '')}`);
  try {
    return JSON.parse(res.body);
  } catch {
    throw new Error(`CBIC did not return data for ${url.replace(BASE, '')}`);
  }
}

export const cbicGstWatcher: FeedWatcher = {
  id: 'cbic-gst',
  label: 'CBIC · GST notifications and circulars',
  act: 'GST',
  homeUrl: `${BASE}/content-page/explore-notification`,
  async list() {
    return parseCbicUpdates(await getJson(`${BASE}/api/cbic-notification-msts/fetchUpdatesByTaxId/${CBIC_GST_TAX_ID}`));
  },
  async fetch(item: FeedItem): Promise<FeedContent> {
    const [kind, id] = item.externalId.split(':');
    const table = kind === 'circular' ? 'cbic-circular-msts' : 'cbic-notification-msts';
    const body = (await getJson(`${BASE}/api/${table}/download/${id}/ENG`)) as { data?: string; fileName?: string };
    if (!body?.data) throw new Error(`CBIC returned no file for ${item.number ?? item.externalId}`);
    const bytes = Buffer.from(body.data, 'base64');
    if (bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error(`CBIC file for ${item.number ?? item.externalId} is not a PDF`);
    const fileName = (body.fileName || `${item.number ?? id}.pdf`).replace(/[\\/]/g, '_');
    return { kind: 'file', bytes, fileName: fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`, contentType: 'application/pdf' };
  },
};
