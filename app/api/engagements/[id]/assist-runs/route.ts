import { listAgentRuns } from '@/db/repositories/assist-agent-runs';
import { parseJsonBody } from '@/lib/api/parse-body';
import { createAgentRunSchema } from '@/lib/assist-agents/api-schemas';
import { assistErrorResponse, assistStaffGuard, guardFailure, json, requestSeen } from '@/lib/assist-agents/http';
import { startAgentRunOp } from '@/lib/assist-agents/run-ops';

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/engagements/[id]/assist-runs — this engagement's agent runs, newest first. Staff in scope. */
export async function GET(_request: Request, context: RouteContext) {
  const guard = await assistStaffGuard();
  if (guard.ok === false) return guardFailure(guard);
  const { id } = await context.params;
  try {
    const runs = await listAgentRuns(guard.ctx, id);
    if (!runs) return json({ ok: false, error: 'not_found' }, 404);
    return json({ ok: true, runs });
  } catch (error) {
    return assistErrorResponse(error, 'list runs');
  }
}

/**
 * POST /api/engagements/[id]/assist-runs — start a run of one sub-agent. The agent, recipe id and
 * recipe version come from the server's catalog, not the body. A live portal host is refused
 * unless the task's own portal pack is live (`cs-cleared` and named in `ASSIST_LIVE_PACKS`; the CS
 * opinion gate); the mock host always works. The run keeps the evidence log: the user, the MCA
 * login label, the device and the client IP. The live browser's callback runs the same operation
 * (`startAgentRunOp`).
 */
export async function POST(request: Request, context: RouteContext) {
  const guard = await assistStaffGuard();
  if (guard.ok === false) return guardFailure(guard);
  const body = await parseJsonBody(request, createAgentRunSchema);
  if (body.ok === false) return json({ ok: false, error: body.error }, body.status);
  const { id } = await context.params;
  try {
    const out = await startAgentRunOp(guard.ctx, id, body.data, requestSeen(request));
    return json(out.body, out.status);
  } catch (error) {
    return assistErrorResponse(error, 'create run');
  }
}
