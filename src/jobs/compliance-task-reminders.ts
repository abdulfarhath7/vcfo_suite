import { inngest } from './client';
import {
  systemDeliverComplianceBells,
  systemMarkReminderEmailed,
  systemPlanComplianceReminders,
  type PlannedReminder,
  type ReminderEmailPlan,
} from '@/db/repositories/compliance-reminder-schedule';
import { buildComplianceReminderEmail } from '@/lib/compliance-tasks/reminder-email';
import { sendEmail } from '@/lib/email/send-email';
import { quietHoursEnd } from '@/lib/notify/prefs-gate';
import { todayIso } from '@/lib/client-portal/compliances';
import { PAUSED, skipWhenPaused, withRunNow } from '@/jobs/dev-controls';

/**
 * Scheduled, daily 08:30 India time: the six reminders of COMPLIANCE-MODEL 3.4 for open
 * non-statutory tasks and unfiled statutory items (docs/ui-port/COMPLIANCE-API.md section 6).
 *
 *  1. Plan: every reminder due today, only for items whose DR-22 set-up is complete (entity,
 *     applicable, owner, preparation date, due date, and no unconfirmed activity point).
 *  2. Bell (R-38): one `compliance.reminder` notification per item, reminder and recipient, at
 *     most once a day (`compliance_reminder_log` unique key).
 *  3. Email (rule 6, the system of record): one email per person listing that day's lines,
 *     after the person's quiet hours end.
 * Returns early while "Pause all jobs" is on. Registered in app/api/inngest/route.ts.
 */
export const complianceTaskReminders = inngest.createFunction(
  { id: 'compliance-task-reminders' },
  withRunNow('compliance-task-reminders', 'TZ=Asia/Kolkata 30 8 * * *'),
  async ({ step }) => {
    if (await skipWhenPaused(step)) return PAUSED;
    const today = todayIso();
    const plan = (await step.run('plan', () => systemPlanComplianceReminders(today))) as PlannedReminder[];
    if (plan.length === 0) return { reminders: 0, emails: 0 };
    const emails = (await step.run('bell', () => systemDeliverComplianceBells(today, plan))) as ReminderEmailPlan[];

    let sent = 0;
    for (const person of emails) {
      const wake = quietHoursEnd({ ...person.quiet, whatsapp: {} }, new Date());
      if (wake) await step.sleepUntil(`quiet-${person.profileId}`, wake);
      const ok = await step.run(`email-${person.profileId}`, async () => {
        const copy = buildComplianceReminderEmail({ recipientName: person.name, lines: person.lines });
        const res = await sendEmail({ to: person.email, subject: copy.subject, html: copy.html, text: copy.text, purpose: 'compliance.reminder' });
        if (res.ok || res.skipped) await systemMarkReminderEmailed(person.logIds);
        return res.ok || Boolean(res.skipped);
      });
      if (ok) sent += 1;
    }
    return { reminders: plan.length, emails: sent };
  },
);
