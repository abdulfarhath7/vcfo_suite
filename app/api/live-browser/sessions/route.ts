import { listLiveSessions } from '@/db/repositories/live-browser-sessions';
import { parseJsonBody } from '@/lib/api/parse-body';
import { assistStaffGuard, guardFailure, json } from '@/lib/assist-agents/http';
import { liveBrowserError } from '@/lib/live-browser/http';
import { startLiveSession, startLiveSessionSchema } from '@/lib/live-browser/start';

/**
 * GET /api/live-browser/sessions?engagementId=&taskId= — one engagement's live sessions, newest
 * first (the card's small live preview and "Open again"). Staff in scope.
 */
export async function GET(request: Request) {
  const guard = await assistStaffGuard();
  if (guard.ok === false) return guardFailure(guard);
  const params = new URL(request.url).searchParams;
  const engagementId = params.get('engagementId');
  if (!engagementId) return json({ ok: false, error: 'engagement_required' }, 400);
  try {
    const sessions = await listLiveSessions(guard.ctx, engagementId, { taskId: params.get('taskId') ?? undefined });
    if (!sessions) return json({ ok: false, error: 'not_found' }, 404);
    return json({ ok: true, sessions });
  } catch (error) {
    return liveBrowserError(error, 'list sessions');
  }
}

/**
 * POST /api/live-browser/sessions — "Fill now": start a live portal session for one card task.
 * Staff only; every check (kill switch, configuration, route switch, recipe, portal host, one
 * session per portal login, hours cap, engagement scope) is in `startLiveSession`.
 */
export async function POST(request: Request) {
  const guard = await assistStaffGuard();
  if (guard.ok === false) return guardFailure(guard);
  const body = await parseJsonBody(request, startLiveSessionSchema);
  if (body.ok === false) return json({ ok: false, error: body.error }, body.status);
  try {
    const out = await startLiveSession(guard.ctx, body.data);
    return json(out.body, out.status);
  } catch (error) {
    return liveBrowserError(error, 'start session');
  }
}
