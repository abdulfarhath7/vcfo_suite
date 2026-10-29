import { inngest } from './client';
import {
  systemListScheduledReports,
  systemMarkReportSent,
  systemReportOwnerContext,
} from '@/db/repositories/saved-reports';
import { sendEmail } from '@/lib/email/send-email';
import { isReportDue } from '@/lib/reports/schedule';
import { partnerParams } from '@/lib/reports/partner-report';
import { renderPartnerReportPdf } from '@/lib/reports/render-partner-report';
import { firmDisplayName } from '@/lib/shell/brand';

/**
 * Scheduled: saved partner reports by email (G-21, `saved_reports`).
 *
 * Daily at 07:00 India time. Every report whose schedule is due (`isReportDue`) is rendered as
 * a PDF under its owner's own AuthContext (so the email never shows more than the owner sees
 * on the Reports page) and sent to its recipients with the PDF attached, through the one email
 * path. `last_sent_at` is stored after an accepted send, or after a local skip when no email
 * provider is set, the same rule `compliance-reminders` follows. A report whose owner is no
 * longer an active super admin is not sent.
 *
 * Registered in app/api/inngest/route.ts.
 */
export const savedReportsSend = inngest.createFunction(
  { id: 'saved-reports-send' },
  { cron: 'TZ=Asia/Kolkata 0 7 * * *' },
  async ({ step }) => {
    const due = await step.run('load-due', async () => {
      const now = new Date();
      const rows = await systemListScheduledReports();
      return rows
        .filter((r) => r.recipients.length > 0)
        .filter((r) => isReportDue(r.schedule, r.lastSentAt ? new Date(r.lastSentAt) : null, now))
        .map((r) => ({ id: r.id, ownerId: r.ownerId, name: r.name, params: r.params, schedule: r.schedule, recipients: r.recipients }));
    });

    let sent = 0;
    for (const report of due) {
      const result = await step.run(`send-${report.id}`, async () => {
        const ctx = await systemReportOwnerContext(report.ownerId);
        if (!ctx) return { ok: false, reason: 'owner_inactive' };
        const rendered = await renderPartnerReportPdf(ctx, partnerParams(report.params), { schedule: report.schedule });
        if (!rendered) return { ok: false, reason: 'month_unavailable' };

        const firm = firmDisplayName();
        const res = await sendEmail({
          to: report.recipients,
          replyTo: ctx.email,
          subject: `${report.name} · ${rendered.monthLabel}`,
          text: `${report.name} for ${rendered.monthLabel} is attached as a PDF.\n\nSent by VCFO Suite for ${firm} on ${ctx.name}'s schedule.\n`,
          html: `<p><b>${escapeHtml(report.name)}</b> for ${escapeHtml(rendered.monthLabel)} is attached as a PDF.</p><p>Sent by VCFO Suite for ${escapeHtml(firm)} on ${escapeHtml(ctx.name)}'s schedule.</p>`,
          purpose: 'saved_report.scheduled',
          attachments: [{ filename: rendered.filename, content: rendered.pdf, contentType: 'application/pdf' }],
        });
        if (res.ok || res.skipped) {
          await systemMarkReportSent(report.id, new Date());
          return { ok: true };
        }
        return { ok: false, reason: res.error ?? 'send_failed' };
      });
      if (result.ok) sent += 1;
    }
    return { due: due.length, sent };
  },
);

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
