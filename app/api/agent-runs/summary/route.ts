import { AgentRunsOverviewForbiddenError, getAgentsTodaySummary } from '@/db/repositories/agent-runs-overview';
import { assistStaffGuard, guardFailure, json } from '@/lib/assist-agents/http';

/**
 * GET /api/agent-runs/summary — "Agents today" on the staff home: how many runs wait for a person,
 * how many are running, what was filed today, and the agent cards due in the next seven days with
 * how many are ready. Staff only, scoped like the list.
 */
export async function GET() {
  const guard = await assistStaffGuard();
  if (guard.ok === false) return guardFailure(guard);
  try {
    return json({ ok: true, summary: await getAgentsTodaySummary(guard.ctx) });
  } catch (error) {
    if (error instanceof AgentRunsOverviewForbiddenError) return json({ ok: false, error: 'forbidden' }, 403);
    console.error('[agent-runs] summary failed', error);
    return json({ ok: false, error: 'server_error' }, 500);
  }
}
