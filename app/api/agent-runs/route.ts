import { AgentRunsOverviewForbiddenError, listAgentRunsOverview } from '@/db/repositories/agent-runs-overview';
import { assistStaffGuard, guardFailure, json } from '@/lib/assist-agents/http';
import { parseAgentRunFilters } from '@/lib/card-agents/overview';

/**
 * GET /api/agent-runs?state=&period=&agent=&search= — the control room (Agent runs): the live
 * browser sessions, the extension runs and the GST return runs in the caller's scope, as one
 * list. Staff only; clients and developers get 403 from the guard. Defaults: every state, this week.
 */
export async function GET(request: Request) {
  const guard = await assistStaffGuard();
  if (guard.ok === false) return guardFailure(guard);
  try {
    const filters = parseAgentRunFilters(new URL(request.url).searchParams);
    return json({ ok: true, filters, ...(await listAgentRunsOverview(guard.ctx, filters)) });
  } catch (error) {
    if (error instanceof AgentRunsOverviewForbiddenError) return json({ ok: false, error: 'forbidden' }, 403);
    console.error('[agent-runs] list failed', error);
    return json({ ok: false, error: 'server_error' }, 500);
  }
}
