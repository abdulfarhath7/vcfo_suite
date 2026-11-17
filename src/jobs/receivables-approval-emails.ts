import { inngest } from './client';
import { RECEIVABLES_APPROVED_EVENT, sendApprovalEmails, type ApprovalEmailsInput } from '@/lib/receivables/v2-send';
import { PAUSED, skipWhenPaused } from '@/jobs/dev-controls';

/**
 * Receivables v2: the new invoice (A) and invoice revised (A′) emails of one approval
 * (docs/specs/receivables/V2.md). Queued by POST /api/receivables/sheets/:id/imports/approve as
 * the event `receivables/invoices.approved`, so approval answers at once. Sent from the approver's
 * Outlook; each email's key in the email log keeps a retried run from sending it twice. Registered
 * in app/api/inngest/route.ts and src/lib/dev/jobs-registry.ts.
 */
export const receivablesApprovalEmails = inngest.createFunction(
  { id: 'receivables-approval-emails', retries: 2 },
  { event: RECEIVABLES_APPROVED_EVENT },
  async ({ event, step }) => {
    if (await skipWhenPaused(step)) return PAUSED;
    const data = event.data as ApprovalEmailsInput;
    if (!data?.sheetId || !data.approverId) return { skipped: 'invalid_payload' };
    return step.run('send', () => sendApprovalEmails(data));
  },
);
