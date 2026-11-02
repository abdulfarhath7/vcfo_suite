import { inngest } from './client';
import { checklist } from '@/data/checklist';
import { systemApprovalAlertRecipients, systemEscalationAlertRecipients, type AlertRecipient } from '@/db/repositories/staff-alerts';
import { sendEmail } from '@/lib/email/send-email';
import { quietHoursEnd } from '@/lib/notify/prefs-gate';
import { STAFF_ALERT_EVENT, buildStaffAlertEmail, type StaffAlertRequest } from '@/lib/notify/staff-alerts';
import { PAUSED, skipWhenPaused } from '@/jobs/dev-controls';

/**
 * Event: one staff alert (`src/lib/notify/staff-alerts.ts`), queued after an approval starts
 * waiting or an escalation opens. Each recipient (with the alert switched on) gets one email
 * through `sendEmail`, the system of record; there is no WhatsApp for these alerts. Inside a
 * recipient's quiet hours the job sleeps until the window ends, then sends.
 *
 * Registered in app/api/inngest/route.ts.
 */

const TITLE = new Map(checklist.map((item) => [item.id, item.title]));

/** Where the alert link opens for the recipient's role. */
export function alertHref(kind: 'approval' | 'escalation', role: string): string {
  if (kind === 'approval') return '/app/manager/approvals';
  return role === 'super_admin' ? '/app/super/risks' : '/app/admin/dashboard';
}

export const staffAlerts = inngest.createFunction(
  { id: 'staff-alerts' },
  { event: STAFF_ALERT_EVENT },
  async ({ event, step }) => {
    if (await skipWhenPaused(step)) return PAUSED;
    const request = event.data as unknown as StaffAlertRequest;
    const plan = await step.run('load-recipients', async () =>
      request.kind === 'approval'
        ? systemApprovalAlertRecipients(request.engagementDbId)
        : systemEscalationAlertRecipients(request.engagementDbId, request.assignedTo),
    );
    if (!plan || plan.recipients.length === 0) return { sent: 0 };

    let sent = 0;
    for (const person of plan.recipients as AlertRecipient[]) {
      const wake = quietHoursEnd({ ...person.quiet, whatsapp: {} }, new Date());
      if (wake) await step.sleepUntil(`quiet-${person.profileId}`, wake);
      const ok = await step.run(`send-${person.profileId}`, async () => {
        const copy = buildStaffAlertEmail({
          kind: request.kind,
          recipientName: person.name,
          companyName: plan.companyName,
          stepTitles: request.kind === 'approval' ? request.stepIds.map((id) => TITLE.get(id) ?? id) : undefined,
          reason: request.kind === 'escalation' ? request.reason : undefined,
          href: alertHref(request.kind, person.role),
        });
        const res = await sendEmail({
          to: person.email,
          subject: copy.subject,
          html: copy.html,
          text: copy.text,
          purpose: request.kind === 'approval' ? 'alert.approval' : 'alert.escalation',
        });
        return res.ok || Boolean(res.skipped);
      });
      if (ok) sent += 1;
    }
    return { sent };
  },
);
