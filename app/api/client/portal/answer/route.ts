import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { getClientOverview } from '@/db/repositories/client-overview';
import { portalAnswer } from '@/lib/client-portal/answers';

/**
 * POST /api/client/portal/answer { question } — the chat's suggested questions,
 * answered from the client's own scoped overview. `answer: null` means the
 * question is not one of them (the chat then asks Ask VCFO, or offers hand-off).
 */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (guard.ctx.role !== 'client') return NextResponse.json({ error: 'Clients only' }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { question?: unknown } | null;
  const question = typeof body?.question === 'string' ? body.question.slice(0, 500) : '';
  if (!question.trim()) return NextResponse.json({ error: 'Type a question first' }, { status: 400 });
  const overview = await getClientOverview(guard.ctx);
  if (!overview) return NextResponse.json({ error: 'No engagement found' }, { status: 404 });
  return NextResponse.json({ answer: portalAnswer(question, overview) });
}
