import { parseJsonBody } from '@/lib/api/parse-body';
import { updateAgentRunSchema } from '@/lib/assist-agents/api-schemas';
import { assistErrorResponse, assistStaffGuard, guardFailure, isRowId, json, requestSeen } from '@/lib/assist-agents/http';
import { getAgentRunOp, updateAgentRunOp } from '@/lib/assist-agents/run-ops';

type RouteContext = { params: Promise<{ id: string; runId: string }> };

/** GET /api/engagements/[id]/assist-runs/[runId] — one run, for a resume after a reload. */
export async function GET(_request: Request, context: RouteContext) {
  const guard = await assistStaffGuard();
  if (guard.ok === false) return guardFailure(guard);
  const { id, runId } = await context.params;
  if (!isRowId(runId)) return json({ ok: false, error: 'not_found' }, 404);
  try {
    const out = await getAgentRunOp(guard.ctx, id, runId);
    return json(out.body, out.status);
  } catch (error) {
    return assistErrorResponse(error, 'get run');
  }
}

/**
 * PATCH /api/engagements/[id]/assist-runs/[runId] — progress, the SRN and the finish. When the run
 * finishes `done` with an SRN, the SRN is appended to the step's filing note where the catalog
 * names one (`srnWriteBack` says what happened); otherwise it stays on the run. Every PATCH notes
 * the client IP in the run's evidence log; `dscSigners` references are resolved to names here.
 */
export async function PATCH(request: Request, context: RouteContext) {
  const guard = await assistStaffGuard();
  if (guard.ok === false) return guardFailure(guard);
  const body = await parseJsonBody(request, updateAgentRunSchema);
  if (body.ok === false) return json({ ok: false, error: body.error }, body.status);
  const { id, runId } = await context.params;
  if (!isRowId(runId)) return json({ ok: false, error: 'not_found' }, 404);
  try {
    const out = await updateAgentRunOp(guard.ctx, id, runId, body.data, requestSeen(request));
    return json(out.body, out.status);
  } catch (error) {
    return assistErrorResponse(error, 'update run');
  }
}
