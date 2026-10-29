import { inngest } from './client';
import {
  reminderLine,
  systemListDueComplianceReminders,
  systemMarkComplianceReminderSent,
} from '@/db/repositories/client-compliances';
import { sendEmail } from '@/lib/email/send-email';
import { todayIso } from '@/lib/client-portal/compliances';
import { PAUSED, skipWhenPaused, withRunNow } from '@/jobs/dev-controls';

/**
 * Scheduled: the client portal "Remind me" on a filing (compliance_reminders).
 * Daily 07:00 — every reminder whose day has come and whose filing is still
 * unfiled gets one email (the system of record). WhatsApp is intentionally not
 * sent from here yet: the six approved EUM templates have no "filing reminder"
 * template (QUESTIONS.md · compliances). Locally, sendEmail logs to the console
 * when no provider key is set.
 *
 * NOTE: register `complianceReminders` in app/api/inngest/route.ts `functions`.
 */
export const complianceReminders = inngest.createFunction(
  { id: 'compliance-reminders' },
  withRunNow('compliance-reminders', '0 7 * * *'),
  async ({ step }) => {
    if (await skipWhenPaused(step)) return PAUSED;
    const due = await step.run('load-due', async () => systemListDueComplianceReminders(todayIso()));
    let sent = 0;
    for (const r of due) {
      await step.run(`send-${r.id}`, async () => {
        const line = reminderLine({ particular: r.particular ?? '', periodLabel: r.periodLabel ?? null, dueDate: r.dueDate ?? '' });
        const res = await sendEmail({
          to: r.email ?? '',
          subject: `Reminder: ${line}`,
          text: `Hi ${r.name ?? ''},\n\n${line} for ${r.companyName ?? ''}.\nOpen your compliance calendar in VCFO Suite to see the details.\n`,
          html: `<p>Hi ${escapeHtml(r.name ?? '')},</p><p><b>${escapeHtml(line)}</b> for ${escapeHtml(r.companyName ?? '')}.</p><p>Open your compliance calendar in VCFO Suite to see the details.</p>`,
          purpose: 'compliance.reminder',
        });
        if (res.ok || res.skipped) {
          await systemMarkComplianceReminderSent(r.id ?? '');
          sent += 1;
        }
        return { ok: res.ok };
      });
    }
    return { due: due.length, sent };
  },
);

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
