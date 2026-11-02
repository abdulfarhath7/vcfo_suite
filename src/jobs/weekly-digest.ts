import { inngest } from './client';
import type { AuthContext } from '@/auth/guards';
import {
  systemListDigestRecordedProfileIds,
  systemListWeeklyDigestRecipients,
  systemRecordDigestDelivery,
} from '@/db/repositories/weekly-digest';
import { collectWeeklyDigest } from '@/lib/digest/collect-weekly-digest';
import { buildWeeklyDigestEmail } from '@/lib/digest/weekly-digest-email';
import { digestWeek } from '@/lib/digest/weekly-digest';
import { sendEmail } from '@/lib/email/send-email';
import { PAUSED, skipWhenPaused, withRunNow } from '@/jobs/dev-controls';

/**
 * Scheduled: the weekly digest (`notification_prefs.email.weeklyDigest`).
 *
 * Mondays at 09:00 India time (the client Settings label says "Monday 9 am"). Every active person whose digest is on (never saved counts as
 * on, the default the Settings screens show) gets one email with their week, read under their
 * own AuthContext through the scoped repositories (`collectWeeklyDigest`), so the mail never
 * shows more than the person sees in the app. Developers get none.
 *
 * Email is the system of record and goes through `sendEmail`; there is no WhatsApp digest.
 * Each person ends with one `notification_deliveries` row (`event_type = 'weekly_digest'`,
 * `template_sid` = ISO week): `sent`, `skipped` (`empty` when there is nothing to say,
 * `disabled` when no email provider is set, the same rule `compliance-reminders` follows) or
 * `failed`. People with a `sent` or `skipped` row for this week are left out, so a rerun in
 * the same week never sends anyone a second digest; a `failed` person is tried again.
 *
 * Registered in app/api/inngest/route.ts.
 */
export const weeklyDigest = inngest.createFunction(
  { id: 'weekly-digest' },
  withRunNow('weekly-digest', 'TZ=Asia/Kolkata 0 9 * * 1'),
  async ({ step }) => {
    if (await skipWhenPaused(step)) return PAUSED;
    const plan = await step.run('load-recipients', async () => {
      const week = digestWeek(new Date());
      const [recipients, done] = await Promise.all([
        systemListWeeklyDigestRecipients(),
        systemListDigestRecordedProfileIds(week.key),
      ]);
      const skip = new Set(done);
      // Plain fields only: step results are JSON, and optional keys would not survive it.
      const due = recipients
        .filter((r) => !skip.has(r.userId))
        .map((r) => ({ userId: r.userId, email: r.email, name: r.name, role: r.role, internId: r.internId ?? null, clientId: r.clientId ?? null }));
      return { weekKey: week.key, due };
    });

    let sent = 0;
    let empty = 0;
    for (const person of plan.due) {
      const result = await step.run(`digest-${person.userId}`, async () => {
        const ctx: AuthContext = {
          userId: person.userId,
          email: person.email,
          name: person.name,
          role: person.role,
          internId: person.internId ?? undefined,
          clientId: person.clientId ?? undefined,
        };
        const digest = await collectWeeklyDigest(ctx, new Date());
        if (!digest) return { status: 'none' as const };
        const copy = buildWeeklyDigestEmail(digest);
        if (!copy) {
          await systemRecordDigestDelivery({
            profileId: person.userId,
            toAddress: person.email,
            status: 'skipped',
            skipReason: 'empty',
            weekKey: plan.weekKey,
          });
          return { status: 'empty' as const };
        }

        const res = await sendEmail({
          to: person.email,
          subject: copy.subject,
          html: copy.html,
          text: copy.text,
          purpose: 'digest.weekly',
        });
        const status = res.ok ? 'sent' : res.skipped ? 'skipped' : 'failed';
        await systemRecordDigestDelivery({
          profileId: person.userId,
          toAddress: person.email,
          status,
          skipReason: res.skipped && !res.ok ? 'disabled' : null,
          errorCode: status === 'failed' ? (res.error ?? 'send_failed') : null,
          weekKey: plan.weekKey,
        });
        return { status };
      });
      if (result.status === 'sent' || result.status === 'skipped') sent += 1;
      if (result.status === 'empty') empty += 1;
    }
    return { week: plan.weekKey, due: plan.due.length, sent, empty };
  },
);
