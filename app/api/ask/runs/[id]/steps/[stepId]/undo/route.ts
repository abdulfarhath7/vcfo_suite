import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnAskRun, setOwnAskRunStepStatus } from '@/db/repositories/ask-runs';
import { getAction } from '@/lib/actions/registry';
import type { JsonValue } from '@/lib/ask/changeset/types';
import { loadAskRunView } from '@/lib/ask/agent/view';
import { requireAsk } from '@/lib/ask/route-guard';

type RouteContext = { params: Promise<{ id: string; stepId: string }> };

/** POST: undoes one private step a run took on its own, as the person who started the run. */
export async function POST(_request: Request, context: RouteContext) {
  const gate = await requireAsk();
  if (gate.ok === false) return gate.response;
  const { id, stepId } = await context.params;
  const ids = z.string().uuid();
  if (!ids.safeParse(id).success || !ids.safeParse(stepId).success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const found = await getOwnAskRun(gate.ctx, id);
  const step = found?.steps.find((s) => s.id === stepId);
  const undo = (step?.output as { undo?: JsonValue } | null)?.undo;
  const action = step ? await getAction(step.name) : null;
  if (!found || !step || step.status !== 'done' || undo == null || !action?.undo) return NextResponse.json({ error: 'This step cannot be undone.' }, { status: 409 });
  const outcome = await action.undo({ auth: gate.ctx, engagementId: found.run.engagementId, conversationId: found.run.conversationId, runId: id, now: new Date(), via: 'ask' }, undo);
  if (outcome.ok === false) return NextResponse.json({ error: outcome.error }, { status: 409 });
  await setOwnAskRunStepStatus(gate.ctx, id, stepId, 'undone');
  return NextResponse.json(await loadAskRunView(gate.ctx, id));
}
