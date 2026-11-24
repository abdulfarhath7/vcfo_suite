import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getFillView } from '@/lib/ask/fill/run';
import { clientRefused, fillRefusal } from '@/lib/ask/fill/route-errors';
import { requireAsk } from '@/lib/ask/route-guard';

type RouteContext = { params: Promise<{ runId: string }> };

/** GET /api/ask/fill/:runId: the fill's steps for the chat rail and the live player. Owner only. */
export async function GET(_request: Request, context: RouteContext) {
  const gate = await requireAsk();
  if (gate.ok === false) return gate.response;
  if (gate.ctx.role === 'client') return clientRefused();
  const { runId } = await context.params;
  if (!z.string().uuid().safeParse(runId).success) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    return NextResponse.json(await getFillView(gate.ctx, runId), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return fillRefusal(error);
  }
}
