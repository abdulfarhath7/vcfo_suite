import { inngest } from './client';
import { isFyKey } from '@/lib/statutory-calendar/fy';
import { STATUTORY_CALENDAR_PUBLISHED_EVENT, syncStatutoryCalendarToAsk } from '@/lib/statutory-calendar/ask-sync';

/** After an admin imports a financial year's statutory calendar, Ask VCFO learns the new dates. */
export const statutoryCalendarAskSync = inngest.createFunction(
  { id: 'statutory-calendar-ask-sync', retries: 2, concurrency: { limit: 1 } },
  { event: STATUTORY_CALENDAR_PUBLISHED_EVENT },
  async ({ event, step }) => {
    const { fy } = event.data as { fy?: string };
    if (!isFyKey(fy)) return { skipped: 'invalid_payload' };
    return step.run('sync', () => syncStatutoryCalendarToAsk(fy));
  },
);
