import 'server-only';

import { ZodError } from 'zod';
import { AssistAgentAccessError, addAgentRunAiUsage, canSpendOnAgentRun, type RequestSeen } from '@/db/repositories/assist-agent-runs';
import { proposePatch } from '@/db/repositories/assist-patches';
import {
  systemApplySessionEvent,
  systemGetLiveSession,
  systemSessionOwnerContext,
  systemSetSessionRun,
  type LiveSessionRow,
} from '@/db/repositories/live-browser-sessions';
import { createAgentRunSchema, proposePatchSchema, updateAgentRunSchema } from '@/lib/assist-agents/api-schemas';
import { findRecipeField } from '@/lib/assist-agents/recipe';
import { getRecipe } from '@/lib/assist-agents/registry';
import { AssistResolveRefused, resolveField } from '@/lib/assist-agents/resolve';
import { getAgentRunOp, startAgentRunOp, updateAgentRunOp, type RunOpResult } from '@/lib/assist-agents/run-ops';
import { LIVE_SESSION_OPEN, type CallbackOp, type LiveSessionStatus, type ViewerSeen } from './contract';

/**
 * THE BROKER'S CALLBACK (`POST /api/live-browser/callback`), after its HMAC signature has been
 * checked by the route. Every op names its session; Suite answers it as the person who started
 * that session (`systemSessionOwnerContext`), for that session's engagement and, once the engine
 * has created it, that session's run only. So the broker can do nothing the person could not do
 * from their own Suite tab, and nothing outside the one filing.
 *
 * The run ops reuse the extension's own operations (`run-ops.ts`, the resolver, the patch queue),
 * so the control room, the certifier gate (G17) and the SRN write-back see a live browser run
 * exactly as they see an extension run. The broker's request reaches Suite from the broker's
 * address, so the run's evidence log records the act viewer the broker saw (G14), marked as such.
 */

const ok = (body: Record<string, unknown>, status = 200): RunOpResult => ({ status, body: { ok: true, ...body } });
const no = (status: number, error: string): RunOpResult => ({ status, body: { ok: false, error } });

function seenFrom(viewer: ViewerSeen | null | undefined, row: LiveSessionRow): RequestSeen {
  return {
    ip: viewer?.ip || 'unknown',
    forwardedFor: `live-browser ${row.node ?? 'node'}${row.egressIp ? ` egress ${row.egressIp}` : ''}`,
    userAgent: viewer?.userAgent ?? null,
  };
}

export async function handleLiveBrowserCallback(op: CallbackOp): Promise<RunOpResult> {
  const row = await systemGetLiveSession(op.sessionId);
  if (!row) return no(404, 'not_found');

  if (op.op === 'event') {
    const saved = await systemApplySessionEvent(row.id, op.event);
    return ok({ status: saved?.status ?? row.status });
  }

  // Run ops only while the session is open: a stopped session cannot write to its run.
  if (!LIVE_SESSION_OPEN.has(row.status as LiveSessionStatus)) return no(409, 'session_closed');
  const ctx = await systemSessionOwnerContext(row, op.demo);
  if (!ctx) return no(403, 'forbidden');

  try {
    switch (op.op) {
      case 'createRun': {
        if (row.runId) return no(409, 'run_exists');
        const data = createAgentRunSchema.parse(op.body);
        // The run is the session's task on the session's portal host, whatever the body says.
        if (data.subAgent !== row.taskId || (row.portalHost && data.portalHost !== row.portalHost)) return no(400, 'not_this_session');
        const out = await startAgentRunOp(ctx, row.engagementId, data, seenFrom(op.seen, row));
        const runId = (out.body.run as { id?: string } | undefined)?.id;
        if (out.status === 201 && runId) await systemSetSessionRun(row.id, runId);
        return out;
      }
      case 'updateRun': {
        if (!row.runId || op.runId !== row.runId) return no(404, 'not_found');
        return await updateAgentRunOp(ctx, row.engagementId, row.runId, updateAgentRunSchema.parse(op.body), seenFrom(op.seen, row));
      }
      case 'attestation': {
        if (!row.runId || op.runId !== row.runId) return no(404, 'not_found');
        return await getAgentRunOp(ctx, row.engagementId, row.runId);
      }
      case 'resolve': {
        const body = { ...op.body, runId: row.runId ?? undefined };
        const allowModel = row.runId ? await canSpendOnAgentRun(ctx, row.runId) : false;
        const result = await resolveField(body, { allowModel });
        if (row.runId && result.aiCalls > 0) await addAgentRunAiUsage(ctx, row.runId, { calls: result.aiCalls, tokens: result.tokens });
        return ok({ ...result });
      }
      case 'proposePatch': {
        if (ctx.demo) return no(403, 'demo');
        const data = proposePatchSchema.parse({ ...op.body, runId: row.runId ?? undefined });
        const recipe = getRecipe(data.recipeId);
        if (!recipe) return no(400, 'unknown_recipe');
        if (!findRecipeField(recipe, data.fieldKey)) return no(400, 'unknown_field');
        return ok({ patch: await proposePatch(ctx, data) }, 201);
      }
      default:
        return no(400, 'unknown_op');
    }
  } catch (error) {
    if (error instanceof AssistAgentAccessError) return no(error.status, error.message);
    if (error instanceof AssistResolveRefused) return no(422, error.message);
    if (error instanceof ZodError) return no(400, error.issues[0]?.message ?? 'invalid_body');
    throw error;
  }
}
