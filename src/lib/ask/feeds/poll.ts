import 'server-only';

import {
  systemCreateFeedDocument,
  systemKnownFeedExternalIds,
  systemSetAskDocumentResult,
  systemSetAskDocumentStorageKey,
} from '@/db/repositories/ask-documents';
import { askSourceStoragePath, queueAskIngestion } from '@/lib/ask/ingest/run';
import { bucketKey, putObject } from '@/storage/s3';
import { FEED_WATCHERS } from './registry';
import type { FeedItem, FeedWatcher } from './types';

/** Never take more than this many new items from one watcher in one run (a first run, or a backlog). */
export const MAX_NEW_PER_WATCHER = 10;

export interface WatcherRunResult {
  feedId: string;
  label: string;
  /** Items the source listed. */
  listed: number;
  /** New items saved and sent to indexing. */
  added: number;
  /** New items that could not be downloaded (retried on the next run). */
  failed: number;
  /** Titles of what was added, newest first. */
  addedTitles: string[];
  error: string | null;
}

/**
 * Pure: which listed items are new, newest first, at most `max`. Kept apart so
 * the de-duplication rule has its own tests.
 */
export function pickNewItems(listed: readonly FeedItem[], known: ReadonlySet<string>, max: number): FeedItem[] {
  const seen = new Set<string>();
  return [...listed]
    .filter((item) => {
      if (known.has(item.externalId) || seen.has(item.externalId)) return false;
      seen.add(item.externalId);
      return true;
    })
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, max);
}

async function runWatcher(watcher: FeedWatcher): Promise<WatcherRunResult> {
  const result: WatcherRunResult = {
    feedId: watcher.id,
    label: watcher.label,
    listed: 0,
    added: 0,
    failed: 0,
    addedTitles: [],
    error: null,
  };
  let listed: FeedItem[];
  try {
    listed = await watcher.list();
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Could not read this source';
    return result;
  }
  result.listed = listed.length;
  const known = await systemKnownFeedExternalIds(watcher.id, listed.map((i) => i.externalId));

  for (const item of pickNewItems(listed, known, MAX_NEW_PER_WATCHER)) {
    // 1. Download first, so a failed download leaves no half-saved source and
    //    the item is simply tried again next time.
    let content;
    try {
      content = await watcher.fetch(item);
    } catch (error) {
      result.failed += 1;
      console.warn('[ask-feeds] download failed', watcher.id, item.externalId, error);
      continue;
    }
    // 2. Save the source row (the unique index makes a parallel run a no-op).
    const doc = await systemCreateFeedDocument({
      feedId: watcher.id,
      externalId: item.externalId,
      title: item.title,
      sourceUrl: item.publicUrl,
      publishedAt: item.publishedAt,
      // Opened to everyone only when a manager approves (review gate).
      audience: 'staff',
    });
    if (!doc) continue;
    // 3. Store the file in S3 (MinIO locally) under the same prefix uploads use.
    try {
      const { bytes, fileName, contentType } =
        content.kind === 'file'
          ? content
          : { bytes: Buffer.from(content.text, 'utf8'), fileName: `${item.externalId.replace(/[^A-Za-z0-9]+/g, '-').slice(-60)}.md`, contentType: 'text/markdown' };
      const key = bucketKey('knowledge-bank', askSourceStoragePath(doc.id, fileName));
      await putObject(key, bytes, contentType);
      await systemSetAskDocumentStorageKey(doc.id, key);
      // 4. Read it: extract → chunk → contextualize → index → summary (same pipeline as uploads).
      await queueAskIngestion(doc.id);
      result.added += 1;
      result.addedTitles.push(item.title);
    } catch (error) {
      result.failed += 1;
      console.error('[ask-feeds] storing update failed', watcher.id, item.externalId, error);
      await systemSetAskDocumentResult(doc.id, { status: 'failed', error: 'Could not store the downloaded file. Use Retry.' });
    }
  }
  return result;
}

/** Check every watcher (or the named ones) once. Used by the daily job and the admin button. */
export async function pollOfficialUpdates(feedIds?: readonly string[]): Promise<WatcherRunResult[]> {
  const watchers = feedIds?.length ? FEED_WATCHERS.filter((w) => feedIds.includes(w.id)) : FEED_WATCHERS;
  const results: WatcherRunResult[] = [];
  // One source at a time: gentle on government servers, and simple to read in logs.
  for (const watcher of watchers) results.push(await runWatcher(watcher));
  return results;
}
