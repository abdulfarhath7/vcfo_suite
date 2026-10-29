import { inngest } from './client';
import type { AuthContext } from '@/auth/guards';
import {
  systemListDailyDigestCandidates,
  systemListDailyDigestRecordedProfileIds,
  systemRecordDailyDigestDelivery,
} from '@/db/repositories/daily-digest';
import { collectWeeklyDigest } from '@/lib/digest/collect-weekly-digest';
import { dailyDigestDueDay } from '@/lib/digest/daily-digest';
import { buildWeeklyDigestEmail } from '@/lib/digest/weekly-digest-email';
import { sendEmail } from '@/lib/email/send-email';

/**
 * Scheduled, hourly: the daily digest (`notification_prefs.digest_time`, P-626, S-656).
 *
 * Each person whose chosen time falls in this hour of their own day (moved to the end of
 * their quiet hours when it falls inside them, `dailyDigestDueDay`) gets one email with
 * their open items. The items are read under their own AuthContext through the weekly
 * digest's collector, and the email is the weekly digest's builder in its `daily` form, so
 * the mail never shows more than the person sees in the app.
 *
 * Email only, through `sendEmail`. Each person ends with one `notification_deliveries` row
 * (`daily_digest`, the local day): `sent`, `skipped` (`empty` or `disabled`) or `failed`. A
 * `sent` or `skipped` row for the day keeps a rerun from sending twice.
 *
 * Registered in app/api/inngest/route.ts.
 */
export const dailyDigest = inngest.createFunction(
  { id: 'daily-digest' },
  { cron: '1 * * * *' },
  async ({ step }) => {
    const plan = await step.run('load-recipients', async () => {
      const now = new Date();
      const candidates = await systemListDailyDigestCandidates();
      const due = candidates
        .map((c) => ({ c, day: dailyDigestDueDay(c.prefs, now) }))
        .filter((x): x is { c: (typeof candidates)[number]; day: string } => x.day !== null);
      const done = await systemListDailyDigestRecordedProfileIds(due.map((x) => x.day));
      const skip = new Set(done.map((d) => `${d.profileId}|${d.day}`));
      // Plain fields only: step results are JSON, and optional keys would not survive it.
      return due
        .filter((x) => !skip.has(`${x.c.ctx.userId}|${x.day}`))
        .map((x) => ({
          userId: x.c.ctx.userId,
          email: x.c.ctx.email,
          name: x.c.ctx.name,
          role: x.c.ctx.role,
          internId: x.c.ctx.internId ?? null,
          clientId: x.c.ctx.clientId ?? null,
          day: x.day,
        }));
    });

    let sent = 0;
    for (const person of plan) {
      const status = await step.run(`digest-${person.userId}`, async () => {
        const ctx: AuthContext = {
          userId: person.userId,
          email: person.email,
          name: person.name,
          role: person.role,
          internId: person.internId ?? undefined,
          clientId: person.clientId ?? undefined,
        };
        const digest = await collectWeeklyDigest(ctx, new Date());
        if (!digest) return 'none';
        const copy = buildWeeklyDigestEmail(digest, 'daily');
        if (!copy) {
          await systemRecordDailyDigestDelivery({ profileId: person.userId, toAddress: person.email, status: 'skipped', skipReason: 'empty', day: person.day });
          return 'empty';
        }
        const res = await sendEmail({ to: person.email, subject: copy.subject, html: copy.html, text: copy.text, purpose: 'digest.daily' });
        const result = res.ok ? 'sent' : res.skipped ? 'skipped' : 'failed';
        await systemRecordDailyDigestDelivery({
          profileId: person.userId,
          toAddress: person.email,
          status: result,
          skipReason: res.skipped && !res.ok ? 'disabled' : null,
          errorCode: result === 'failed' ? (res.error ?? 'send_failed') : null,
          day: person.day,
        });
        return result;
      });
      if (status === 'sent' || status === 'skipped') sent += 1;
    }
    return { due: plan.length, sent };
  },
);
