import { assertSessionOwner, systemEndSession } from '@/db/repositories/live-browser-sessions';
import { assistStaffGuard, guardFailure, json } from '@/lib/assist-agents/http';
import { brokerPost } from '@/lib/live-browser/broker-client';
import { isSessionId, liveBrowserError } from '@/lib/live-browser/http';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/live-browser/sessions/[id]/stop — end a session: the broker cancels the run, closes
 * the browser and deletes its profile. The person who started it, or an admin or manager in scope.
 * The session is closed in Suite even when the broker does not answer; the reaper retries the stop.
 */
export async function POST(_request: Request, context: RouteContext) {
  const guard = await assistStaffGuard();
  if (guard.ok === false) return guardFailure(guard);
  const { id } = await context.params;
  if (!isSessionId(id)) return json({ ok: false, error: 'not_found' }, 404);
  try {
    const session = await assertSessionOwner(guard.ctx, id);
    if (session.open) {
      await brokerPost(`/sessions/${id}/stop`, { sessionId: id, reason: 'cancelled' }).catch((error: Error) => console.error('[live-browser] stop not delivered', error.message));
      await systemEndSession(id, 'cancelled', 'Stopped in VCFO Suite.');
    }
    return json({ ok: true });
  } catch (error) {
    return liveBrowserError(error, 'stop session');
  }
}
