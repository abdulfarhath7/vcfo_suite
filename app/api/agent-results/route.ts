import { requireAdmin } from '@/auth/guards';
import { AgentRunsOverviewForbiddenError, getAgentResults } from '@/db/repositories/agent-runs-overview';
import { getAgentSettings } from '@/db/repositories/agent-settings';
import { guardFailure, json } from '@/lib/assist-agents/http';
import { currentMonth, isMonth } from '@/lib/card-agents/overview';
import { MINUTES_SAVED_NOTE } from '@/lib/card-agents/minutes-saved';

/**
 * GET /api/agent-results?month=YYYY-MM — the Agent results page (MASTER-PLAN.md screen 11):
 * filings by agent, fields auto-filled, heals and recipe breaks, live browser hours and the
 * estimated minutes saved. Firm-wide admins only (super admin and admin). The month defaults to
 * the current month in India.
 */
export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (guard.ok === false) return guardFailure(guard);
  const asked = new URL(request.url).searchParams.get('month');
  if (asked && !isMonth(asked)) return json({ ok: false, error: 'invalid_month' }, 400);
  const month = asked ?? currentMonth(new Date());
  try {
    const settings = await getAgentSettings(guard.ctx);
    const results = await getAgentResults(guard.ctx, month, settings.browserHoursCap);
    return json({ ok: true, results, estimateNote: MINUTES_SAVED_NOTE });
  } catch (error) {
    if (error instanceof AgentRunsOverviewForbiddenError) return json({ ok: false, error: 'forbidden' }, 403);
    console.error('[agent-results] failed', error);
    return json({ ok: false, error: 'server_error' }, 500);
  }
}
