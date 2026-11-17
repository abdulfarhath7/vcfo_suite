import { inngest } from './client';
import { systemSheetsWithAutoEmails } from '@/db/repositories/receivables';
import { sendSheetDigest } from '@/lib/receivables/v2-send';
import { PAUSED, skipWhenPaused, withRunNow } from '@/jobs/dev-controls';

/**
 * Receivables v2 leadership digest (email C, docs/specs/receivables/V2.md). Replaces the Monday
 * manager digest. Runs every hour at :10 IST; a sheet with the digest switched on sends on its
 * `digest_weekday` once `digest_hour_ist` has come: one email to every active digest recipient
 * (typed-in names and addresses), partner ▸ client ▸ table with totals, from the sheet manager's
 * Outlook, followed by the WhatsApp ping to the manager. The email log's `digest:<sheet>:<date>`
 * key keeps it to once that day. Returns early while "Pause all jobs" is on. Registered in
 * app/api/inngest/route.ts and src/lib/dev/jobs-registry.ts.
 */
export const receivablesLeadershipDigest = inngest.createFunction(
  { id: 'receivables-leadership-digest' },
  withRunNow('receivables-leadership-digest', 'TZ=Asia/Kolkata 10 * * * *'),
  async ({ step }) => {
    if (await skipWhenPaused(step)) return PAUSED;
    const sheets = await step.run('load-sheets', async () => (await systemSheetsWithAutoEmails()).filter((s) => s.digestEnabled).map((s) => s.id));
    const outcomes: Record<string, string> = {};
    for (const id of sheets) {
      outcomes[id] = await step.run(`digest-${id}`, async () => {
        const all = await systemSheetsWithAutoEmails();
        const sheet = all.find((s) => s.id === id);
        return sheet ? sendSheetDigest(sheet) : 'skipped';
      });
    }
    return { sheets: sheets.length, outcomes };
  },
);
