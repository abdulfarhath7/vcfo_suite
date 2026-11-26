import { getAgentSettings } from '@/db/repositories/agent-settings';
import { assistStaffGuard, guardFailure, json } from '@/lib/assist-agents/http';
import { brokerPost } from '@/lib/live-browser/broker-client';
import { liveBrowserError } from '@/lib/live-browser/http';
import { browserConfigured } from '@/lib/card-agents/config';
import { routeOpenFor } from '@/lib/card-agents/settings';

/**
 * POST /api/live-browser/warm — the card panel opened: ask the broker to keep an empty browser
 * ready, so "Fill now" shows the portal in about a second. Nothing opens a portal and no session
 * starts; an unused warm browser closes after two minutes (CARD-AGENTS.md "one-click start").
 */
export async function POST() {
  const guard = await assistStaffGuard();
  if (guard.ok === false) return guardFailure(guard);
  try {
    if (!browserConfigured()) return json({ ok: true, warm: false });
    const settings = await getAgentSettings(guard.ctx);
    if (!routeOpenFor(settings, 'browser', guard.ctx.userId)) return json({ ok: true, warm: false });
    const reply = await brokerPost('/warm', { at: Date.now() }).catch(() => null);
    return json({ ok: true, warm: reply?.status === 202 });
  } catch (error) {
    return liveBrowserError(error, 'warm');
  }
}
