import { askConfig } from '@/lib/ask/config';

export const STATUTORY_CALENDAR_PUBLISHED_EVENT = 'statutory-calendar/published';

/**
 * Loads one financial year's statutory calendar into Ask VCFO's knowledge, so its answers about
 * due dates follow the calendar an admin just imported, then embeds the new chunks. Safe to repeat:
 * an unchanged calendar stops at the chunk comparison.
 */
export async function syncStatutoryCalendarToAsk(fyKey: string) {
  const { systemGetStatutoryCalendar } = await import('@/db/repositories/statutory-calendar');
  const { systemLoadRepoDocument } = await import('@/db/repositories/ask-documents');
  const { statutoryCalendarSource } = await import('@/lib/ask/ingest/repo-sources');
  const { backfillEmbeddings } = await import('@/lib/ask/embeddings/backfill');
  const view = await systemGetStatutoryCalendar(fyKey);
  if (view.deadlines.length === 0) return { fy: fyKey, result: 'empty' as const };
  const result = await systemLoadRepoDocument(statutoryCalendarSource(view.fy.key, view.deadlines));
  const embedded = await backfillEmbeddings();
  return { fy: fyKey, result, embedded };
}

/**
 * Queues the sync after an import. It never throws and never slows the import, and does nothing
 * while Ask VCFO is off. Without Inngest (local dev) it runs in-process.
 */
export function queueStatutoryCalendarAskSync(fyKey: string): void {
  if (!askConfig().enabled) return;
  void (async () => {
    try {
      const { inngest } = await import('@/jobs/client');
      await inngest.send({ name: STATUTORY_CALENDAR_PUBLISHED_EVENT, data: { fy: fyKey } });
    } catch {
      await syncStatutoryCalendarToAsk(fyKey);
    }
  })().catch((error) => console.error('[statutory-calendar] Ask VCFO sync failed', error));
}
