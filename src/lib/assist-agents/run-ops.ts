import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { AssistAgentAccessError, createAgentRun, getAgentRun, updateAgentRun, type RequestSeen } from '@/db/repositories/assist-agent-runs';
import { assertEngagementAccess } from '@/db/repositories/engagements';
import { assistProfileFor } from '@/lib/api/assist-profile';
import { createAgentRunSchema, updateAgentRunSchema } from '@/lib/assist-agents/api-schemas';
import { assistHostAllowed, findSubAgent } from '@/lib/assist-agents/catalog';
import { resolveDscSigners } from '@/lib/assist-agents/dsc-signers';
import { recordRunSrn } from '@/lib/assist-agents/record-srn';
import { getRecipe } from '@/lib/assist-agents/registry';
import { engagementDbId } from '@/lib/projects/legacy-engagement-ids';
import type { z } from 'zod';

/**
 * The VCFO Assist run operations, shared by the extension's routes
 * (`/api/engagements/[id]/assist-runs…`, a Suite session) and the live browser's callback
 * (`/api/live-browser/callback`, a signed server call answered as the person who started the
 * session). Each returns a status and a JSON body, so both callers answer the same way.
 */

export type RunOpResult = { status: number; body: Record<string, unknown> };

/**
 * Start a run of one sub-agent. The agent, recipe id and recipe version come from the server's
 * catalog, not the body. A live portal host is refused unless the task's own pack is live (G11).
 */
export async function startAgentRunOp(ctx: AuthContext, engagementParam: string, data: z.infer<typeof createAgentRunSchema>, seen: RequestSeen): Promise<RunOpResult> {
  const sub = findSubAgent(data.subAgent);
  if (!sub) return { status: 400, body: { ok: false, error: 'unknown_sub_agent' } };
  const recipe = sub.recipeId ? getRecipe(sub.recipeId) : null;
  if (!recipe) return { status: 400, body: { ok: false, error: 'no_recipe' } };
  if (data.recipeVersion && data.recipeVersion !== recipe.version) {
    return { status: 409, body: { ok: false, error: 'recipe_outdated', recipeVersion: recipe.version } };
  }
  if (!assistHostAllowed(data.portalHost, process.env, sub.pack ?? recipe.pack ?? null)) return { status: 403, body: { ok: false, error: 'live_portals_disabled' } };
  const run = await createAgentRun(
    ctx,
    engagementParam,
    {
      agent: sub.agent,
      subAgent: sub.id,
      recipeId: recipe.id,
      recipeVersion: recipe.version,
      fieldsTotal: data.fieldsTotal ?? recipe.fields.length,
      state: data.state,
      mcaLoginLabel: data.mcaLoginLabel,
      device: data.device,
      extensionVersion: data.extensionVersion,
    },
    seen,
  );
  if (!run) return { status: 404, body: { ok: false, error: 'not_found' } };
  return { status: 201, body: { ok: true, run } };
}

/** One run, reached through its engagement (the URL may name it by uuid, legacy id or slug). */
export async function getAgentRunOp(ctx: AuthContext, engagementParam: string, runId: string): Promise<RunOpResult> {
  const run = await getAgentRun(ctx, runId);
  const access = run ? await assertEngagementAccess(ctx, engagementParam) : null;
  if (!run || !access?.ok || engagementDbId(run.engagementId) !== access.dbId) return { status: 404, body: { ok: false, error: 'not_found' } };
  return { status: 200, body: { ok: true, run } };
}

/**
 * Progress, the SRN and the finish. When the run finishes `done` with an SRN, the SRN is written
 * to the step's filing note where the catalog names one (`srnWriteBack`). `dscSigners` references
 * are resolved to names from Suite's own records; the caller never sends a name.
 */
export async function updateAgentRunOp(ctx: AuthContext, engagementParam: string, runId: string, data: z.infer<typeof updateAgentRunSchema>, seen: RequestSeen): Promise<RunOpResult> {
  const { dscSigners: refs, ...rest } = data;
  let dscSigners;
  if (refs) {
    const built = await assistProfileFor(ctx, engagementParam);
    if (built.ok === false) return { status: 404, body: { ok: false, error: 'not_found' } };
    dscSigners = resolveDscSigners(built.result.profile, refs, { name: ctx.name, email: ctx.email });
    if (!dscSigners) throw new AssistAgentAccessError('unknown_signer', 400);
  }
  const { run, finished, engagementDbId: dbId } = await updateAgentRun(ctx, engagementParam, runId, { ...rest, ...(dscSigners ? { dscSigners } : {}) }, seen);
  // The resolved uuid, not the URL's id: the URL may name the engagement by its slug.
  const srnWriteBack = finished && run.status === 'done' && run.srn ? await recordRunSrn(ctx, dbId, run.subAgent, run.srn) : undefined;
  return { status: 200, body: { ok: true, run, ...(srnWriteBack ? { srnWriteBack } : {}) } };
}
