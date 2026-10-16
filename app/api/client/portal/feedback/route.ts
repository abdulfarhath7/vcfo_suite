import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { recordAnswerFeedback } from '@/db/repositories/ask-feedback';

const bodySchema = z.object({
  vote: z.enum(['up', 'down']),
  messageId: z.string().uuid().optional(),
  question: z.string().max(2000).optional(),
  answer: z.string().max(4000).optional(),
});

/** POST /api/client/portal/feedback — 👍/👎 under an Ask VCFO answer in the portal chat. */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (guard.ctx.role !== 'client') return NextResponse.json({ error: 'Clients only' }, { status: 403 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid feedback' }, { status: 400 });
  return NextResponse.json(await recordAnswerFeedback(guard.ctx, parsed.data), { status: 201 });
}
