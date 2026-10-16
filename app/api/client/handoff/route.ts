import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { ASK_HANDOFF_MAX_QUESTION, createAskHandoff } from '@/db/repositories/ask-handoff';
import { getMyEngagement } from '@/db/repositories/engagements';

const bodySchema = z.object({
  question: z.string().trim().min(1).max(ASK_HANDOFF_MAX_QUESTION),
  conversationId: z.string().uuid().optional(),
  context: z.string().max(4000).optional(),
});

/**
 * POST /api/client/handoff — the portal chat's "Hand off to <lead>" button.
 * Same record as Ask VCFO's T5 hand-off (a task on the lead + a bell), but it
 * works whether or not the Ask VCFO model is switched on. The engagement is
 * always the caller's own (`getMyEngagement`), never a caller-supplied id.
 */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (guard.ctx.role !== 'client') return NextResponse.json({ error: 'Clients only' }, { status: 403 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Write your question first' }, { status: 400 });
  const mine = await getMyEngagement(guard.ctx);
  if (!mine) return NextResponse.json({ error: 'No engagement found' }, { status: 404 });
  const created = await createAskHandoff(guard.ctx, { engagementId: mine.id, ...parsed.data });
  if (!created) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  return NextResponse.json({ handoff: created }, { status: 201 });
}
