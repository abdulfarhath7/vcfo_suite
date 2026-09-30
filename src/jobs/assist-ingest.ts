import { inngest } from './client';
import { ASSIST_INGEST_EVENT, runAssistIngestion } from '@/lib/assist/ingest/run';

/**
 * Assist knowledge-source ingestion. One step: the runner is idempotent
 * (chunks replaced wholesale) and records its own failure state, so a retry
 * is always safe.
 */
export const assistIngest = inngest.createFunction(
  { id: 'assist-ingest', retries: 2, concurrency: { limit: 2 } },
  { event: ASSIST_INGEST_EVENT },
  async ({ event, step }) => {
    const documentId = String((event.data as { documentId?: unknown })?.documentId ?? '');
    if (!documentId) return { skipped: 'invalid_payload' };
    return step.run('ingest', () => runAssistIngestion(documentId));
  },
);
