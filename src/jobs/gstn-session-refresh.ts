import { inngest } from './client';
import { PAUSED, skipWhenPaused, withRunNow } from '@/jobs/dev-controls';
import { gstzenConfigured } from '@/lib/card-agents/config';
import { systemAgentSettings } from '@/db/repositories/agent-settings';
import { systemExpireOtpRequests } from '@/db/repositories/agent-otp';
import { systemLapsedSessions, systemMarkSessionInactive, systemMarkSessionRefreshed, systemSessionsDueForRefresh } from '@/db/repositories/gstn-sessions';
import { gstzen } from '@/lib/gstzen/client';
import { sessionExpiryOf } from '@/lib/gstzen/mappers';

/**
 * GSTN session refresh, every 15 minutes. GSTZen's docs: a GSTN session can be refreshed about 15
 * minutes before it goes inactive, and kept alive this way for up to 30 days from the consent; a
 * session not refreshed expires and needs a new consent OTP. This job refreshes every active session
 * that goes inactive in the next 30 minutes, marks lapsed ones inactive, and closes expired OTP
 * requests. It stops while GSTZen is not configured, the kill switch is on or the admin switch is
 * off, and while "Pause all jobs" is on. Registered in app/api/inngest/route.ts.
 */

const WINDOW_MS = 30 * 60_000;

export const gstnSessionRefresh = inngest.createFunction(
  { id: 'gstn-session-refresh' },
  withRunNow('gstn-session-refresh', '*/15 * * * *'),
  async ({ step }) => {
    if (await skipWhenPaused(step)) return PAUSED;
    const expired = await step.run('expire-otp-requests', () => systemExpireOtpRequests());
    if (!gstzenConfigured()) return { skipped: 'not_configured', expired };
    const settings = await step.run('settings', () => systemAgentSettings());
    if (settings.killSwitch || !settings.gstzen.live) return { skipped: 'route_off', expired };

    const lapsed = await step.run('lapsed', async () => {
      const rows = await systemLapsedSessions(new Date());
      for (const r of rows) await systemMarkSessionInactive(r.gstin);
      return rows.length;
    });
    const due = await step.run('due', async () => (await systemSessionsDueForRefresh(new Date(), WINDOW_MS)).map((r) => r.gstin));
    let refreshed = 0;
    for (const gstin of due) {
      const ok = await step.run(`refresh-${gstin}`, async () => {
        try {
          const msg = await gstzen().refreshSession(gstin);
          const now = new Date();
          await systemMarkSessionRefreshed(gstin, sessionExpiryOf(msg, now), now);
          return true;
        } catch {
          await systemMarkSessionInactive(gstin);
          return false;
        }
      });
      if (ok) refreshed += 1;
    }
    return { expired, lapsed, due: due.length, refreshed };
  },
);
