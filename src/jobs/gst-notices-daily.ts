import { inngest } from './client';
import { PAUSED, skipWhenPaused, withRunNow } from '@/jobs/dev-controls';
import { gstzenConfigured } from '@/lib/card-agents/config';
import { systemAgentSettings } from '@/db/repositories/agent-settings';
import { systemActiveSessions } from '@/db/repositories/gstn-sessions';
import { systemMeetingPeople } from '@/db/repositories/board-meetings';
import { systemNoticeEngagement } from '@/db/repositories/gst-notices';
import { createNotificationsForUsers } from '@/db/repositories/notifications';
import { sendEmail } from '@/lib/email/send-email';
import { emailParagraph, escapeHtml, renderEmailDocument } from '@/lib/email/email-layout';
import { siteUrl } from '@/lib/site-url';
import { roleAppSegment } from '@/lib/auth-routes';
import { appEngagementId } from '@/lib/projects/legacy-engagement-ids';
import { GST_STEP_ID } from '@/lib/registrations/gst-tracker';
import { syncNoticesForGstin } from '@/lib/gstzen/notices';

/**
 * GST notice watcher, daily 07:47 India time. For every GSTIN with an active GSTN session it lists
 * the notices of the last 60 days through GSTZen's read-only notice API, stores new ones
 * (`gst_notices`, detail without document bodies) and updates the state of known ones. Each new open
 * notice gets the project lead an email (the system of record) and a bell notification. Replies stay
 * with the person on the portal. It stops while GSTZen is not configured, the kill switch is on or
 * the admin switch is off, and while "Pause all jobs" is on. Registered in app/api/inngest/route.ts.
 */
export const gstNoticesDaily = inngest.createFunction(
  { id: 'gst-notices-daily' },
  withRunNow('gst-notices-daily', 'TZ=Asia/Kolkata 47 7 * * *'),
  async ({ step }) => {
    if (await skipWhenPaused(step)) return PAUSED;
    if (!gstzenConfigured()) return { skipped: 'not_configured' };
    const settings = await step.run('settings', () => systemAgentSettings());
    if (settings.killSwitch || !settings.gstzen.live) return { skipped: 'route_off' };

    const sessions = await step.run('sessions', () => systemActiveSessions(new Date()));
    let fresh = 0;
    let told = 0;
    for (const s of sessions) {
      const added = await step.run(`notices-${s.gstin}`, async () => {
        try {
          return await syncNoticesForGstin(s.engagementId, s.gstin);
        } catch {
          return [];
        }
      });
      fresh += added.length;
      const open = added.filter((n) => n.state === 'open');
      if (!open.length) continue;
      told += await step.run(`tell-${s.gstin}`, async () => {
        const engagement = await systemNoticeEngagement(s.engagementId);
        if (!engagement) return 0;
        const team = await systemMeetingPeople(engagement);
        if (!team.lead) return 0;
        const appId = appEngagementId(engagement.id);
        const href = `/app/${roleAppSegment('intern')}/registrations/${encodeURIComponent(`${appId}~${GST_STEP_ID}`)}`;
        const title = open.length === 1 ? `New GST notice: ${engagement.companyName}` : `${open.length} new GST notices: ${engagement.companyName}`;
        const lines = open.map((n) => `${n.noticeType ?? 'Notice'}${n.dueOn ? `, reply due ${n.dueOn}` : ''} (reference ${n.refId})`);
        const body = `The GST portal issued ${open.length === 1 ? 'a notice' : `${open.length} notices`} to GSTIN ${s.gstin}. ${lines.join('; ')}. Read ${open.length === 1 ? 'it' : 'them'} on the GST portal and draft the reply in Suite.`;
        await sendEmail({
          to: team.lead.email,
          subject: title,
          html: renderEmailDocument({ eyebrow: 'GST notice', title, bodyHtml: emailParagraph(escapeHtml(body)), cta: { label: 'Open the GST registration', href: `${siteUrl()}${href}` } }),
          text: `${title}\n${body}\n${siteUrl()}${href}`,
          purpose: 'gstzen.notice',
        });
        await createNotificationsForUsers([{ userId: team.lead.id, kind: 'compliance.reminder', title, body, engagementId: appId, companyName: engagement.companyName, itemId: GST_STEP_ID, href }]).catch(() => []);
        return 1;
      });
    }
    return { gstins: sessions.length, fresh, told };
  },
);
