import { NextResponse } from 'next/server';
import { z } from 'zod';
import { acceptManualStep, stopFill } from '@/lib/ask/fill/run';
import { clientRefused, fillRefusal } from '@/lib/ask/fill/route-errors';
import { requireAsk } from '@/lib/ask/route-guard';

type RouteContext = { params: Promise<{ runId: string }> };

const body = z.object({ stepId: z.string().min(1).max(64), action: z.enum(['accepted', 'stop']) });

/** POST /api/ask/fill/:runId/step: Manual mode's "the page is saved and submitted", or Stop. */
export async function POST(request: Request, context: RouteContext) {
  const gate = await requireAsk();
  if (gate.ok === false) return gate.response;
  if (gate.ctx.role === 'client') return clientRefused();
  const { runId } = await context.params;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !z.string().uuid().safeParse(runId).success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  try {
    const view = parsed.data.action === 'stop' ? await stopFill(gate.ctx, runId) : await acceptManualStep(gate.ctx, runId, parsed.data.stepId);
    return NextResponse.json(view);
  } catch (error) {
    return fillRefusal(error);
  }
}
