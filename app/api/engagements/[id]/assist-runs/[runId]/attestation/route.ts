import { recordAttestation } from '@/db/repositories/assist-attestations';
import { parseJsonBody } from '@/lib/api/parse-body';
import { attestationSchema } from '@/lib/assist-agents/api-schemas';
import { assistErrorResponse, assistStaffGuard, guardFailure, isRowId, json, requestSeen } from '@/lib/assist-agents/http';

type RouteContext = { params: Promise<{ id: string; runId: string }> };

/**
 * POST /api/engagements/[id]/assist-runs/[runId]/attestation — the certifier records the checks
 * they made personally (SAFETY.md G17). Staff only, on a run in the caller's scope. The VCFO Assist
 * side panel shows "You do this: Submit and Pay" only once this exists.
 *
 * Errors: 400 `attestation_incomplete` (a check this form needs is missing), 400
 * `unknown_document`, 403 `certifier_must_differ` (firm setting on and the caller ran the agent),
 * 404 `not_found`, 409 `already_attested`, `run_closed` or `run_not_filled`.
 */
export async function POST(request: Request, context: RouteContext) {
  const guard = await assistStaffGuard();
  if (guard.ok === false) return guardFailure(guard);
  const body = await parseJsonBody(request, attestationSchema);
  if (body.ok === false) return json({ ok: false, error: body.error }, body.status);
  const { id, runId } = await context.params;
  if (!isRowId(runId)) return json({ ok: false, error: 'not_found' }, 404);
  try {
    const attestation = await recordAttestation(guard.ctx, id, runId, body.data, requestSeen(request));
    return json({ ok: true, attestation }, 201);
  } catch (error) {
    return assistErrorResponse(error, 'record attestation');
  }
}
