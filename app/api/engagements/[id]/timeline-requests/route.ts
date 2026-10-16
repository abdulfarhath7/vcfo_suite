import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { listTimelineRequests } from '@/db/repositories/client-change-requests';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/engagements/:id/timeline-requests — the client's timeline change requests (scoped read). */
export async function GET(_request: Request, ctx: Ctx) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await ctx.params;
  return NextResponse.json({ requests: await listTimelineRequests(guard.ctx, id) });
}
