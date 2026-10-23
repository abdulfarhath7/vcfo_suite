import 'server-only';

import {
  systemGetAskDocument,
  systemReplaceAskChunks,
  systemSetAskDocumentResult,
  systemSetAskDocumentReviewPdf,
  systemSetAskDocumentSummary,
  type AskDocumentRow,
} from '@/db/repositories/ask-documents';
import { summarizeOfficialUpdate } from './summarize';
import { notifyManagersOfPendingUpdate } from '@/lib/regulatory/notify';
import { watcherById } from '@/lib/ask/feeds/registry';
import { renderReviewPdf } from '@/lib/ask/feeds/review-pdf';
import { firmDisplayName } from '@/lib/brand';
import { bucketKey, getObjectBuffer, putObject } from '@/storage/s3';
import { askConfig } from '@/lib/ask/config';
import { getAskProvider } from '@/lib/ask/provider';
import { chunkDocument } from './chunk';
import { contextualizeChunks } from './contextualize';
import { ExtractError, extractSourceText } from './extract';

export const ASK_INGEST_EVENT = 'ask/document.ingest';

/** Storage key convention for uploaded Ask VCFO sources (knowledge-bank prefix). */
export function askSourceStoragePath(documentId: string, fileName: string): string {
  const safe = fileName.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-120) || 'source';
  return `ask-sources/${documentId}/${safe}`;
}

/**
 * Extract → chunk → contextualize → replace chunks → ready. Idempotent: the
 * chunk set is replaced wholesale, so a retry never duplicates rows. Any
 * failure marks the source `failed` with a readable reason.
 */
export async function runAskIngestion(documentId: string): Promise<{ status: 'ready' | 'failed' | 'skipped'; chunks: number }> {
  const doc = await systemGetAskDocument(documentId);
  if (!doc || doc.status === 'archived' || !doc.s3Key) return { status: 'skipped', chunks: 0 };
  try {
    const bytes = await getObjectBuffer(doc.s3Key);
    if (!bytes) throw new ExtractError('The uploaded file is missing from storage.');
    const config = askConfig();
    const provider = await getAskProvider();
    const text = await extractSourceText({
      bytes,
      fileName: doc.s3Key.split('/').pop() ?? doc.s3Key,
      contentType: null,
      provider,
      model: config.models.contextualizer,
    });
    const chunks = chunkDocument(text);
    if (chunks.length === 0) throw new ExtractError('No text was found in this file.');
    const prefixes = await contextualizeChunks({
      provider,
      model: config.models.contextualizer,
      title: doc.title,
      documentText: text,
      chunks,
    });
    await systemReplaceAskChunks(
      doc.id,
      chunks.map((c, i) => ({ ordinal: c.ordinal, text: c.text, contextPrefix: prefixes[i] ?? null })),
    );
    // Official updates get a two-sentence "what changed" for recent-update
    // questions. Best effort: a failed summary never fails the indexing.
    let summary: string | null = doc.summary ?? null;
    if (doc.feedId && provider) {
      try {
        summary = await summarizeOfficialUpdate({ provider, model: config.models.contextualizer, title: doc.title, text });
        await systemSetAskDocumentSummary(doc.id, summary);
      } catch (error) {
        console.warn('[ask-vcfo] update summary failed', documentId, error);
      }
    }
    await systemSetAskDocumentResult(doc.id, { status: 'ready' });
    // Official update, first time it is ready: write the manager's review
    // document and tell the managers. A re-index of an already reviewed or
    // already announced update stays quiet.
    if (doc.feedId && doc.reviewStatus === 'pending' && !doc.reviewPdfKey) {
      await prepareOfficialUpdateReview({ ...doc, summary }, text, chunks.length);
    }
    return { status: 'ready', chunks: chunks.length };
  } catch (error) {
    const reason = error instanceof ExtractError ? error.message : 'Indexing failed. Try again.';
    console.error('[ask-vcfo] ingestion failed', documentId, error);
    await systemSetAskDocumentResult(doc.id, { status: 'failed', error: reason });
    return { status: 'failed', chunks: 0 };
  }
}

/**
 * Review pack for a newly read official update: the review PDF goes to
 * storage next to the source file, and the managers get a bell and an email.
 * Failures are logged, never thrown — the update is still indexed and still
 * listed as pending on the review page.
 */
async function prepareOfficialUpdateReview(doc: AskDocumentRow, text: string, pieces: number): Promise<void> {
  const watcher = watcherById(doc.feedId ?? '');
  try {
    const pdf = await renderReviewPdf({
      firmName: firmDisplayName(),
      sourceLabel: watcher?.label ?? 'Official source',
      act: watcher?.act ?? 'Regulatory',
      title: doc.title,
      number: numberFromTitle(doc.title),
      kind: /circular/i.test(doc.title) ? 'Circular' : 'Notification',
      publishedAt: doc.publishedAt,
      sourceUrl: doc.sourceUrl,
      summary: doc.summary,
      text,
      pieces,
    });
    const key = bucketKey('knowledge-bank', askSourceStoragePath(doc.id, 'review.pdf'));
    await putObject(key, pdf, 'application/pdf');
    await systemSetAskDocumentReviewPdf(doc.id, key);
  } catch (error) {
    console.error('[ask-vcfo] review pdf failed', doc.id, error);
  }
  try {
    await notifyManagersOfPendingUpdate(doc);
  } catch (error) {
    console.error('[ask-vcfo] manager notice failed', doc.id, error);
  }
}

/** "Notification 01/2026-Central Tax (Rate) · …" → "01/2026-Central Tax (Rate)". */
function numberFromTitle(title: string): string | null {
  const m = /^(?:Notification|Circular)\s+([^·]+?)\s*(?:·|$)/i.exec(title) ?? /(RBI\/\d{4}-\d{2}\/\d+)/.exec(title);
  return m?.[1]?.trim() ?? null;
}

/**
 * Queue ingestion on Inngest; when no Inngest is reachable (local dev, or
 * cloud keys not yet set) run it in-process so a source never sits in
 * "processing" forever.
 */
export async function queueAskIngestion(documentId: string): Promise<'queued' | 'inline'> {
  try {
    const { inngest } = await import('@/jobs/client');
    await inngest.send({ name: ASK_INGEST_EVENT, data: { documentId } });
    return 'queued';
  } catch (error) {
    console.warn('[ask-vcfo] inngest unavailable; indexing inline', error);
    void runAskIngestion(documentId);
    return 'inline';
  }
}
