import { NextResponse } from 'next/server';

import { requireAnyRole } from '@/auth/guards';
import { getAgentSettings } from '@/db/repositories/agent-settings';
import { assertEngagementAccess } from '@/db/repositories/engagements';
import { cardTasksFor } from '@/lib/card-agents/card-agents';
import { cardAgentInfosFor, recipeSections } from '@/lib/card-agents/levels';

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0, must-revalidate' };

const STEP_ID = /^[a-z]+-\d{1,3}$/;
const OBLIGATION_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_STEP_IDS = 60;

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status, headers: NO_STORE });

/**
 * GET /api/card-agents — the card robots (docs/specs/live-portal-browser/MASTER-PLAN.md screens
 * 2 and 3). Staff only: super admin, admin, manager and project lead; a client gets 403.
 *
 * - `?engagementId=&stepId=` or `?engagementId=&obligationId=` (with `&instanceId=` for one
 *   filing period): `{ agents, companyName, sections }` for that card; `sections` names, per
 *   task, the Assist profile sections its recipe fills (the "Before I fill" scope). The
 *   engagement must be one the caller may open (`assertEngagementAccess`), so a lead sees only
 *   their own clients.
 * - `?stepIds=reg-1,reg-4,...` with no engagement: `{ steps: { [stepId]: agents } }`, the levels
 *   the Registrations boxes show. The levels do not depend on a client, so no engagement is read.
 *
 * Nothing starts here: the levels come from the catalog, the pack switches, the deployment's
 * configuration and the admin's Settings > Agents switches.
 */
export async function GET(request: Request) {
  const auth = await requireAnyRole('admin', 'manager', 'intern');
  if (auth.ok === false) return fail(auth.status, auth.error);
  const params = new URL(request.url).searchParams;
  const settings = await getAgentSettings(auth.ctx);

  const stepIdsParam = params.get('stepIds');
  if (stepIdsParam !== null && !params.get('engagementId')) {
    const ids = [...new Set(stepIdsParam.split(',').map((s) => s.trim()).filter(Boolean))];
    if (ids.length === 0 || ids.length > MAX_STEP_IDS || ids.some((id) => !STEP_ID.test(id))) return fail(400, 'invalid_step_ids');
    const steps: Record<string, ReturnType<typeof cardAgentInfosFor>> = {};
    for (const id of ids) steps[id] = cardAgentInfosFor(cardTasksFor({ stepId: id }), settings, auth.ctx.userId);
    return NextResponse.json({ ok: true, steps }, { headers: NO_STORE });
  }

  const engagementId = params.get('engagementId')?.trim() ?? '';
  const stepId = params.get('stepId')?.trim() || null;
  const obligationId = params.get('obligationId')?.trim() || null;
  if (!engagementId || engagementId.length > 128) return fail(400, 'engagement_required');
  if (!stepId === !obligationId) return fail(400, 'step_or_obligation_required');
  if (stepId && !STEP_ID.test(stepId)) return fail(400, 'invalid_step_id');
  if (obligationId && !OBLIGATION_ID.test(obligationId)) return fail(400, 'invalid_obligation_id');

  const access = await assertEngagementAccess(auth.ctx, engagementId);
  if (access.ok === false) return 'notFound' in access ? fail(404, 'not_found') : fail(403, 'forbidden');

  const tasks = cardTasksFor({ stepId, obligationId });
  const agents = cardAgentInfosFor(tasks, settings, auth.ctx.userId);
  const sections = Object.fromEntries(tasks.map((t) => [t.id, recipeSections(t)]));
  return NextResponse.json({ ok: true, agents, companyName: access.row.companyName, sections }, { headers: NO_STORE });
}
