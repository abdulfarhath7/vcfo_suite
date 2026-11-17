import { inngest } from './client';
import { RECEIVABLES_EMAIL_SENT_EVENT, pingSender } from '@/lib/receivables/v2-send';
import { PAUSED, skipWhenPaused } from '@/jobs/dev-controls';

/**
 * Receivables v2: the WhatsApp ping (DoubleTick) to the person whose Outlook just sent a
 * receivables email (docs/specs/receivables/V2.md). Queued only after Outlook accepted the email,
 * as the event `receivables/email.sent`; it records `sent`, `failed`, `no_phone` or `disabled` on
 * the email log row and never touches the email. No retries: a ping that failed once is not worth
 * a second message later. Registered in app/api/inngest/route.ts and src/lib/dev/jobs-registry.ts.
 */
export const receivablesEmailPing = inngest.createFunction(
  { id: 'receivables-email-ping', retries: 0 },
  { event: RECEIVABLES_EMAIL_SENT_EVENT },
  async ({ event, step }) => {
    if (await skipWhenPaused(step)) return PAUSED;
    const logId = (event.data as { logId?: string })?.logId;
    if (!logId) return { skipped: 'invalid_payload' };
    return { whatsapp: await step.run('ping', () => pingSender(logId)) };
  },
);
