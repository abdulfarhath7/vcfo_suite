import { getLiveSession } from '@/db/repositories/live-browser-sessions';
import { assistStaffGuard, guardFailure, json } from '@/lib/assist-agents/http';
import { isSessionId, liveBrowserError } from '@/lib/live-browser/http';

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/live-browser/sessions/[id] — one session's state, gate and progress. Staff in scope. */
export async function GET(_request: Request, context: RouteContext) {
  const guard = await assistStaffGuard();
  if (guard.ok === false) return guardFailure(guard);
  const { id } = await context.params;
  if (!isSessionId(id)) return json({ ok: false, error: 'not_found' }, 404);
  try {
    const session = await getLiveSession(guard.ctx, id);
    if (!session) return json({ ok: false, error: 'not_found' }, 404);
    return json({ ok: true, session, me: guard.ctx.userId });
  } catch (error) {
    return liveBrowserError(error, 'get session');
  }
}
