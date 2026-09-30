import 'server-only';

import {
  systemGetAssistDocument,
  systemReplaceAssistChunks,
  systemSetAssistDocumentResult,
} from '@/db/repositories/assist-documents';
import { getObjectBuffer } from '@/storage/s3';
import { assistConfig } from '@/lib/assist/config';
import { getAssistProvider } from '@/lib/assist/provider';
import { chunkDocument } from './chunk';
import { contextualizeChunks } from './contextualize';
import { ExtractError, extractSourceText } from './extract';

export const ASSIST_INGEST_EVENT = 'assist/document.ingest';

/** Storage key convention for uploaded Assist sources (knowledge-bank prefix). */
export function assistSourceStoragePath(documentId: string, fileName: string): string {
  const safe = fileName.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-120) || 'source';
  return `assist-sources/${documentId}/${safe}`;
}

/**
 * Extract → chunk → contextualize → replace chunks → ready. Idempotent: the
 * chunk set is replaced wholesale, so a retry never duplicates rows. Any
 * failure marks the source `failed` with a readable reason.
 */
export async function runAssistIngestion(documentId: string): Promise<{ status: 'ready' | 'failed' | 'skipped'; chunks: number }> {
  const doc = await systemGetAssistDocument(documentId);
  if (!doc || doc.status === 'archived' || !doc.s3Key) return { status: 'skipped', chunks: 0 };
  try {
    const bytes = await getObjectBuffer(doc.s3Key);
    if (!bytes) throw new ExtractError('The uploaded file is missing from storage.');
    const config = assistConfig();
    const provider = await getAssistProvider();
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
    await systemReplaceAssistChunks(
      doc.id,
      chunks.map((c, i) => ({ ordinal: c.ordinal, text: c.text, contextPrefix: prefixes[i] ?? null })),
    );
    await systemSetAssistDocumentResult(doc.id, { status: 'ready' });
    return { status: 'ready', chunks: chunks.length };
  } catch (error) {
    const reason = error instanceof ExtractError ? error.message : 'Indexing failed. Try again.';
    console.error('[assist] ingestion failed', documentId, error);
    await systemSetAssistDocumentResult(doc.id, { status: 'failed', error: reason });
    return { status: 'failed', chunks: 0 };
  }
}

/**
 * Queue ingestion on Inngest; when no Inngest is reachable (local dev, or
 * cloud keys not yet set) run it in-process so a source never sits in
 * "processing" forever.
 */
export async function queueAssistIngestion(documentId: string): Promise<'queued' | 'inline'> {
  try {
    const { inngest } = await import('@/jobs/client');
    await inngest.send({ name: ASSIST_INGEST_EVENT, data: { documentId } });
    return 'queued';
  } catch (error) {
    console.warn('[assist] inngest unavailable; indexing inline', error);
    void runAssistIngestion(documentId);
    return 'inline';
  }
}
