import { assertSessionOwner, getLiveSession } from '@/db/repositories/live-browser-sessions';
import { assistStaffGuard, guardFailure, json } from '@/lib/assist-agents/http';
import { viewerAccess } from '@/lib/live-browser/broker-client';
import { isSessionId, liveBrowserError } from '@/lib/live-browser/http';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/live-browser/sessions/[id]/token?role=watch|act — a two-minute viewer token for the
 * stream (proposed G20). `watch` (frames only) goes to any staff member on the engagement; `act`
 * (frames and input, the portal tab) only to the person who started the session, whose portal
 * login it is, or an admin or manager in scope. Clients and other leads get 403 or 404. A closed
 * session gets 410: its stream is gone.
 */
export async function GET(request: Request, context: RouteContext) {
  const guard = await assistStaffGuard();
  if (guard.ok === false) return guardFailure(guard);
  const { id } = await context.params;
  if (!isSessionId(id)) return json({ ok: false, error: 'not_found' }, 404);
  const role = new URL(request.url).searchParams.get('role') === 'act' ? 'act' : 'watch';
  try {
    const session = role === 'act' ? await assertSessionOwner(guard.ctx, id) : await getLiveSession(guard.ctx, id);
    if (!session) return json({ ok: false, error: 'not_found' }, 404);
    if (!session.open) return json({ ok: false, error: 'session_closed' }, 410);
    return json({ ok: true, ...viewerAccess(session.id, guard.ctx.userId, role) });
  } catch (error) {
    return liveBrowserError(error, 'viewer token');
  }
}
