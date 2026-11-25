import { NextResponse } from 'next/server';
import { z } from 'zod';
import { submitReadySteps } from '@/lib/ask/fill/run';
import { clientRefused, fillRefusal } from '@/lib/ask/fill/route-errors';
import { requireAsk } from '@/lib/ask/route-guard';

type RouteContext = { params: Promise<{ runId: string }> };

/**
 * POST /api/ask/fill/:runId/submit-ready: "Submit ready steps" on a settled fill. Submits each
 * complete step in checklist order through the step's own submit and stops at the first step that
 * is not ready, with the reason. Staff only.
 */
export async function POST(_request: Request, context: RouteContext) {
  const gate = await requireAsk();
  if (gate.ok === false) return gate.response;
  if (gate.ctx.role === 'client') return clientRefused();
  const { runId } = await context.params;
  if (!z.string().uuid().safeParse(runId).success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  try {
    return NextResponse.json(await submitReadySteps(gate.ctx, runId));
  } catch (error) {
    return fillRefusal(error);
  }
}
