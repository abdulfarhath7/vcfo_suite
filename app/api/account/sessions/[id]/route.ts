import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwnAccount } from '@/auth/guards';
import { revokeOwnSession } from '@/db/repositories/user-sessions';

type RouteContext = { params: Promise<{ id: string }> };

/** DELETE /api/account/sessions/[id] — signs out one of the caller's own devices (G-25). */
export async function DELETE(_request: Request, context: RouteContext) {
  const guard = await requireOwnAccount();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  const ok = await revokeOwnSession(guard.ctx, id);
  if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true, current: id === guard.ctx.sessionId });
}
