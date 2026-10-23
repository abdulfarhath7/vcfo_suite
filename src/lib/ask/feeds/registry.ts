import 'server-only';

import { cbicGstWatcher } from './cbic';
import { dgftWatcher } from './dgft';
import { epfoWatcher } from './epfo';
import { esicWatcher } from './esic';
import { rbiFemaWatcher } from './rbi';
import type { FeedWatcher } from './types';

/**
 * Every official source Ask VCFO watches. Add a source = add a watcher here.
 *
 * Checked 2026-10-23 from this machine (owner's portal list):
 *   ✓ CBIC tax information portal (GST notifications + circulars) — JSON
 *   ✓ RBI notifications RSS (filtered to FEMA)                    — RSS
 *   ✓ EPFO circulars (WordPress page, employer-relevant only)      — HTML
 *   ✓ ESIC circulars (table, employer-relevant only)              — HTML
 *   ✓ DGFT notifications, public notices, circulars (tables)      — HTML
 *   ✗ GST portal "News and Updates" — answers non-browsers with an anti-robot page
 *     (the law itself is published on CBIC, which we read)
 *   ✗ Income Tax (incometaxindia.gov.in), MCA (mca.gov.in) — 403 to any program;
 *     the e-Gazette lists their notifications but its downloads need a browser session
 *   ✗ Telangana Commercial Taxes (tgct.gov.in) — PDFs without a dated list
 * The ✗ sources stay manual: an admin drops their PDF on the Sources page.
 */
export const FEED_WATCHERS: readonly FeedWatcher[] = [cbicGstWatcher, rbiFemaWatcher, epfoWatcher, esicWatcher, dgftWatcher];

export function watcherById(id: string): FeedWatcher | undefined {
  return FEED_WATCHERS.find((w) => w.id === id);
}

/** Display facts for the Sources page (safe for the client bundle via the API). */
export function feedLabel(id: string | null | undefined): { label: string; act: string } | null {
  const w = id ? watcherById(id) : undefined;
  return w ? { label: w.label, act: w.act } : null;
}
