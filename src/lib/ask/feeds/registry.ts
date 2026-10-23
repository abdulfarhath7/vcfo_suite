import 'server-only';

import { cbicGstWatcher } from './cbic';
import { dgftWatcher } from './dgft';
import { epfoWatcher } from './epfo';
import { esicWatcher } from './esic';
import { gstPortalWatcher } from './gst-portal';
import { incomeTaxWatcher } from './income-tax';
import { rbiFemaWatcher } from './rbi';
import { tgctWatcher } from './tgct';
import type { FeedWatcher } from './types';

/**
 * Every official source Ask VCFO watches. Add a source = add a watcher here.
 *
 * The owner's portal list (PDF, 2026-10-23) and what each entry gives us:
 *   GST portal (services.gst.gov.in … gstlawlist)
 *     ✓ its "News and Updates" advisories        — `gst-portal` (needs a real browser; see browser-fetch.ts)
 *     ✓ the notifications its "GST Law" page links to, on CBIC — `cbic-gst` (JSON)
 *   Income Tax (incometaxindia.gov.in: refuses programs and headless Chrome)
 *     ✓ the department's e-filing portal "Latest News", same CBDT notifications + PDFs — `income-tax` (HTML)
 *   MCA (mca.gov.in: "Access Denied" to programs and headless Chrome)
 *     ✗ manual — drop the notification PDF on the Sources page (e-Gazette PDFs by id work; its listing needs a session)
 *   EPFO  ✓ notices feed, employer-relevant only                 — `epfo` (RSS)
 *   ESIC  ✓ circulars table, employer-relevant only              — `esic` (HTML)
 *   Telangana Commercial Taxes (tgct.gov.in)
 *     ✓ announcements list (undated on the portal; dated when first seen) — `tgct` (HTML)
 *   DGFT  ✓ notifications, public notices, circulars, trade notices — `dgft` (HTML)
 *   RBI   ✓ notifications RSS, filtered to FEMA                   — `rbi-fema` (RSS; PDF-only notices are flagged for manual download)
 */
export const FEED_WATCHERS: readonly FeedWatcher[] = [
  cbicGstWatcher,
  gstPortalWatcher,
  incomeTaxWatcher,
  rbiFemaWatcher,
  epfoWatcher,
  esicWatcher,
  tgctWatcher,
  dgftWatcher,
];

export function watcherById(id: string): FeedWatcher | undefined {
  return FEED_WATCHERS.find((w) => w.id === id);
}

/** Display facts for the Sources page (safe for the client bundle via the API). */
export function feedLabel(id: string | null | undefined): { label: string; act: string } | null {
  const w = id ? watcherById(id) : undefined;
  return w ? { label: w.label, act: w.act } : null;
}
