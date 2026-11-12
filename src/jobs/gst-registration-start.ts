import { inngest } from './client';
import { systemGstDueToday } from '@/db/repositories/gst-registration';
import { systemMeetingPeople } from '@/db/repositories/board-meetings';
import { createNotificationsForUsers } from '@/db/repositories/notifications';
import { sendEmail } from '@/lib/email/send-email';
import { emailParagraph, escapeHtml, renderEmailDocument } from '@/lib/email/email-layout';
import { siteUrl } from '@/lib/site-url';
import { roleAppSegment } from '@/lib/auth-routes';
import { appEngagementId } from '@/lib/projects/legacy-engagement-ids';
import { GST_STEP_ID } from '@/lib/registrations/gst-tracker';
import { PAUSED, skipWhenPaused, withRunNow } from '@/jobs/dev-controls';

/**
 * GST registration day reminder, daily 08:30 India time. On the day an engagement's GST
 * registration is scheduled on the firm calendar (the step's schedule window; see
 * `gst-tracker.ts`) and no ARN is recorded yet, the project lead and the manager each get an
 * email (the system of record) and a bell notification: the application and the LUT are
 * filed today. It reminds SBC staff only. It never writes to a client and never touches a
 * government portal (firm policy SBC-STD-AI-02). Returns early while "Pause all jobs" is on.
 * Registered in app/api/inngest/route.ts.
 */

const todayIst = (now = new Date()) => new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);

export const gstRegistrationStart = inngest.createFunction(
  { id: 'gst-registration-start' },
  withRunNow('gst-registration-start', 'TZ=Asia/Kolkata 30 8 * * *'),
  async ({ step }) => {
    if (await skipWhenPaused(step)) return PAUSED;
    const today = todayIst();
    const sent = await step.run('remind', async () => {
      let n = 0;
      for (const { engagement } of await systemGstDueToday(today)) {
        const team = await systemMeetingPeople(engagement);
        const appId = appEngagementId(engagement.id);
        const recordKey = encodeURIComponent(`${appId}~${GST_STEP_ID}`);
        const title = `GST registration scheduled today: ${engagement.companyName}`;
        const body =
          'GST registration is scheduled for today on the firm calendar. The authorised signatory files the application and the LUT on the GST portal in their own session, and the ARN is then recorded in the tool.';
        const people = [
          team.lead ? { ...team.lead, base: `/app/${roleAppSegment('intern')}` } : null,
          team.manager ? { ...team.manager, base: `/app/${roleAppSegment('manager')}` } : null,
        ].filter((p): p is NonNullable<typeof p> => p !== null);
        for (const person of people) {
          const href = `${person.base}/registrations/${recordKey}`;
          await sendEmail({
            to: person.email,
            subject: title,
            html: renderEmailDocument({ eyebrow: 'GST registration', title, bodyHtml: emailParagraph(escapeHtml(body)), cta: { label: 'Open the registration', href: `${siteUrl()}${href}` } }),
            text: `${title}\n${body}\n${siteUrl()}${href}`,
            purpose: 'registration.gst.start',
          });
          await createNotificationsForUsers([
            { userId: person.id, kind: 'compliance.reminder', title, body, engagementId: appId, companyName: engagement.companyName, itemId: GST_STEP_ID, href },
          ]).catch(() => []);
          n += 1;
        }
      }
      return n;
    });
    return { sent };
  },
);
