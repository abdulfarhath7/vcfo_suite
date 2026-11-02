/**
 * Run the Ask VCFO official-update watchers ONCE (local helper).
 *
 *   npm run ask:feeds:once
 *
 * Same work as the 30-minute Inngest job (src/jobs/ask-feeds.ts) — asks every
 * government source on the portal list what it published and indexes anything
 * new for a manager to review — without starting the Inngest dev server, which
 * would also fire the other timed jobs (compliance reminders send real email
 * when RESEND_API_KEY is set).
 *
 * Without Inngest each new item is indexed inline in the background
 * (queueAskIngestion); before exiting, this script indexes and waits for any
 * official update still marked `processing`, so none is left half-done.
 */
import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { askDocuments } from '@/db/schema';
import { pollOfficialUpdates } from '@/lib/ask/feeds/poll';
import { runAskIngestion } from '@/lib/ask/ingest/run';

const results = await pollOfficialUpdates();
for (const r of results) {
  console.log(`${r.feedId.padEnd(14)} listed ${String(r.listed).padStart(3)} · new ${String(r.added).padStart(3)} · failed ${r.failed}${r.error ? ` · ${r.error}` : ''}`);
}

const stuck = await db
  .select({ id: askDocuments.id, title: askDocuments.title })
  .from(askDocuments)
  .where(and(eq(askDocuments.status, 'processing'), isNotNull(askDocuments.feedId)));
for (const d of stuck) {
  const r = await runAskIngestion(d.id);
  console.log(`indexed: ${r.status} (${r.chunks} pieces) · ${d.title.slice(0, 70)}`);
}
process.exit(0);
