import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ASK_HANDOFF_MAX_QUESTION, createAskHandoff } from '@/db/repositories/ask-handoff';
import { requireAsk } from '@/lib/ask/route-guard';

const bodySchema = z.object({
  engagementId: z.string().trim().min(1),
  question: z.string().trim().min(1).max(ASK_HANDOFF_MAX_QUESTION),
  conversationId: z.string().uuid().optional(),
  context: z.string().max(4000).optional(),
});

/** POST /api/ask/handoff — "Ask my lead" (T5). Client only; creates a task for the lead. */
export async function POST(request: Request) {
  const gate = await requireAsk();
  if (gate.ok === false) return gate.response;
  if (gate.ctx.role !== 'client') {
    return NextResponse.json({ error: 'Only clients can ask their lead from Ask VCFO' }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Write your question first' }, { status: 400 });
  try {
    const created = await createAskHandoff(gate.ctx, parsed.data);
    if (!created) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    return NextResponse.json({ handoff: created }, { status: 201 });
  } catch (error) {
    console.error('[ask-vcfo] handoff failed', error);
    return NextResponse.json({ error: 'Could not send your question. Please try again.' }, { status: 500 });
  }
}
