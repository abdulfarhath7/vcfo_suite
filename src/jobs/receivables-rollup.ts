import { inngest } from './client';
import { systemSheetsWithAutoEmails } from '@/db/repositories/receivables';
import { sendSheetRollups } from '@/lib/receivables/v2-send';
import { PAUSED, skipWhenPaused, withRunNow } from '@/jobs/dev-controls';

/**
 * Receivables v2 roll-up (email B, docs/specs/receivables/V2.md). Runs every hour at :05 IST; for
 * each sheet whose roll-up is switched on it sends when the sheet's send hour has come and
 * `rollup_every_days` days have passed since the last roll-up. One email per client partner with
 * the roll-up switch on and open invoices, from the sheet manager's Outlook, each followed by the
 * WhatsApp ping to the manager. The email log's `rollup:<partner>:<date>` key stops a second run
 * (or "Run now") from sending the same day twice. Returns early while "Pause all jobs" is on.
 * Registered in app/api/inngest/route.ts and src/lib/dev/jobs-registry.ts.
 */
export const receivablesRollup = inngest.createFunction(
  { id: 'receivables-rollup' },
  withRunNow('receivables-rollup', 'TZ=Asia/Kolkata 5 * * * *'),
  async ({ step }) => {
    if (await skipWhenPaused(step)) return PAUSED;
    const sheets = await step.run('load-sheets', async () => (await systemSheetsWithAutoEmails()).filter((s) => s.emailRollupEnabled).map((s) => s.id));
    let sent = 0;
    let failed = 0;
    for (const id of sheets) {
      const r = await step.run(`rollup-${id}`, async () => {
        const all = await systemSheetsWithAutoEmails();
        const sheet = all.find((s) => s.id === id);
        return sheet ? sendSheetRollups(sheet) : { sent: 0, failed: 0, skipped: 0 };
      });
      sent += r.sent;
      failed += r.failed;
    }
    return { sheets: sheets.length, sent, failed };
  },
);
