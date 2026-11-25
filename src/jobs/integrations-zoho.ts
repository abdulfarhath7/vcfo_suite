import { inngest } from './client';
import { ZOHO_DISCOVER_EVENT, runZohoDiscover } from '@/lib/integrations/zoho/run-discover';
import { ZOHO_RECEIVABLES_EVENT, runZohoSheetSync } from '@/lib/integrations/zoho/run-receivables';

/**
 * Zoho discovery (docs/specs/integrations/ZOHO.md): lists every Zoho app's organisations, counts
 * them, reads one sample record per app and auto maps orgs, customers and CRM accounts. One run
 * at a time per connection; a failure is written on the job row by `runZohoDiscover` itself.
 */
export const zohoDiscover = inngest.createFunction(
  { id: 'integrations-zoho-discover', retries: 0, concurrency: { limit: 1, key: 'event.data.jobId' } },
  { event: ZOHO_DISCOVER_EVENT },
  async ({ event, step }) => {
    const jobId = String((event.data as { jobId?: unknown })?.jobId ?? '');
    if (!jobId) return { skipped: 'invalid_payload' };
    await step.run('discover', () => runZohoDiscover(jobId));
    return { jobId };
  },
);

/**
 * Sync from Zoho on a receivable sheet: the period's invoices or payments, staged for approval.
 * One run at a time per sheet; a failure is written on the job row by `runZohoSheetSync`.
 */
export const zohoReceivablesSync = inngest.createFunction(
  { id: 'integrations-zoho-receivables-sync', retries: 0, concurrency: { limit: 1, key: 'event.data.jobId' } },
  { event: ZOHO_RECEIVABLES_EVENT },
  async ({ event, step }) => {
    const jobId = String((event.data as { jobId?: unknown })?.jobId ?? '');
    if (!jobId) return { skipped: 'invalid_payload' };
    await step.run('sync', () => runZohoSheetSync(jobId));
    return { jobId };
  },
);
