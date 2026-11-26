import { inngest } from './client';
import { PAUSED, skipWhenPaused, withRunNow } from '@/jobs/dev-controls';
import { demoEnabled, runInDemo, runInMain } from '@/db/demo-scope';
import { systemAgentSettings } from '@/db/repositories/agent-settings';
import { systemEndSession, systemListOpenSessions, type LiveSessionRow } from '@/db/repositories/live-browser-sessions';
import { brokerPost } from '@/lib/live-browser/broker-client';
import { browserConfigured } from '@/lib/card-agents/config';
import type { AgentSettings } from '@/lib/card-agents/settings';
import type { LiveSessionEndReason } from '@/lib/live-browser/contract';

/** Extra minutes past a limit before the reaper steps in (the broker ends sessions itself first). */
const GRACE_MINUTES = 2;
/** A session still `starting` after this long never opened. */
const START_MINUTES = 5;

/** Why an open session must end now, or null. Pure, for the tests. */
export function reapReason(row: Pick<LiveSessionRow, 'status' | 'createdAt' | 'lastActivityAt'>, settings: Pick<AgentSettings, 'killSwitch' | 'idleMinutes' | 'maxMinutes'>, configured: boolean, now: Date): LiveSessionEndReason | null {
  const minutes = (d: Date) => (now.getTime() - d.getTime()) / 60_000;
  if (!configured) return 'error';
  if (settings.killSwitch) return 'kill_switch';
  if (minutes(row.createdAt) > settings.maxMinutes + GRACE_MINUTES) return 'max_time';
  if (minutes(row.lastActivityAt) > settings.idleMinutes + GRACE_MINUTES) return 'idle';
  if (row.status === 'starting' && minutes(row.createdAt) > START_MINUTES) return 'error';
  return null;
}

const NOTE: Record<LiveSessionEndReason, string> = {
  done: 'Done.',
  cancelled: 'Stopped.',
  idle: 'Stopped after no activity.',
  max_time: 'Stopped at the time limit.',
  kill_switch: 'Stopped by the kill switch.',
  error: 'The live browser lost this session.',
};

async function sweep(now: Date): Promise<{ checked: number; ended: number }> {
  const settings = await systemAgentSettings();
  const configured = browserConfigured();
  const open = await systemListOpenSessions();
  let ended = 0;
  for (const row of open) {
    let reason = reapReason(row, settings, configured, now);
    if (!reason && configured) {
      // The broker restarted or lost the session: the table must not say it is still open.
      const status = await brokerPost(`/sessions/${row.id}/status`, { sessionId: row.id }).catch(() => null);
      if (status?.status === 404) reason = 'error';
    }
    if (!reason) continue;
    if (configured) await brokerPost(`/sessions/${row.id}/stop`, { sessionId: row.id, reason }).catch(() => null);
    await systemEndSession(row.id, reason, NOTE[reason]);
    ended += 1;
  }
  return { checked: open.length, ended };
}

/**
 * LIVE BROWSER REAPER, every five minutes: ends open live sessions that are idle, over their hard
 * stop, stopped by the kill switch, or that the broker no longer holds, so `live_browser_sessions`
 * never says a browser is open when it is not (proposed G19). The broker applies the same limits
 * itself; this is the second net. Runs on the main database and, when demo logins are on, on the
 * demo database. Returns early while "Pause all jobs" is on. Registered in app/api/inngest/route.ts.
 */
export const liveBrowserReaper = inngest.createFunction(
  { id: 'live-browser-reaper' },
  withRunNow('live-browser-reaper', '*/5 * * * *'),
  async ({ step }) => {
    if (await skipWhenPaused(step)) return PAUSED;
    const main = await step.run('main', () => runInMain(() => sweep(new Date())));
    const demo = demoEnabled()
      ? await step.run('demo', () =>
          runInDemo(() => sweep(new Date())).catch((error: Error) => {
            console.error('[live-browser] demo sweep failed', error.message);
            return { checked: 0, ended: 0 };
          }),
        )
      : { checked: 0, ended: 0 };
    return { main, demo };
  },
);
