import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { recordAnswerFeedback } from '@/db/repositories/ask-feedback';
import { parseJsonBody } from '@/lib/api/parse-body';

const bodySchema = z.object({
  vote: z.enum(['up', 'down']),
  messageId: z.string().uuid().optional(),
  question: z.string().max(2000).optional(),
  answer: z.string().max(4000).optional(),
});

/**
 * POST /api/ask/feedback — "Helpful?" vote under a staff Ask VCFO answer (G-24).
 * The staff twin of `/api/client/portal/feedback`; the vote is stored for the
 * caller only, and a message id counts only when it is in their own conversation.
 */
export async function POST(request: Request) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: 'Invalid feedback' }, { status: 400 });
  return NextResponse.json(await recordAnswerFeedback(guard.ctx, body.data), { status: 201 });
}
