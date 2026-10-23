import 'server-only';

import { cbicGstWatcher } from './cbic';
import { rbiFemaWatcher } from './rbi';
import type { FeedWatcher } from './types';

/**
 * Every official source Ask VCFO watches. Add a source = add a watcher here.
 *
 * Checked 2026-10-22 from this machine:
 *   ✓ CBIC tax information portal (GST notifications + circulars) — JSON
 *   ✓ RBI notifications RSS (filtered to FEMA)                    — RSS
 *   ✗ GST portal "News and Updates" — answers non-browsers with an anti-robot page
 *   ✗ Income Tax (incometaxindia.gov.in), MCA (mca.gov.in) — 403 to automated readers
 *   ✗ EPFO circulars — page moved (404)
 * The ✗ sources stay manual: an admin drops their PDF on the Sources page.
 */
export const FEED_WATCHERS: readonly FeedWatcher[] = [cbicGstWatcher, rbiFemaWatcher];

export function watcherById(id: string): FeedWatcher | undefined {
  return FEED_WATCHERS.find((w) => w.id === id);
}

/** Display facts for the Sources page (safe for the client bundle via the API). */
export function feedLabel(id: string | null | undefined): { label: string; act: string } | null {
  const w = id ? watcherById(id) : undefined;
  return w ? { label: w.label, act: w.act } : null;
}
