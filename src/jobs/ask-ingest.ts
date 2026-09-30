import { inngest } from './client';
import { ASK_INGEST_EVENT, runAskIngestion } from '@/lib/ask/ingest/run';

/**
 * Ask VCFO knowledge-source ingestion. One step: the runner is idempotent
 * (chunks replaced wholesale) and records its own failure state, so a retry
 * is always safe.
 */
export const askIngest = inngest.createFunction(
  { id: 'ask-ingest', retries: 2, concurrency: { limit: 2 } },
  { event: ASK_INGEST_EVENT },
  async ({ event, step }) => {
    const documentId = String((event.data as { documentId?: unknown })?.documentId ?? '');
    if (!documentId) return { skipped: 'invalid_payload' };
    return step.run('ingest', () => runAskIngestion(documentId));
  },
);
