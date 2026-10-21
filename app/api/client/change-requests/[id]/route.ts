import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { withdrawClientTimelineRequest } from '@/db/repositories/client-change-requests';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * DELETE /api/client/change-requests/[id] — the requester withdraws their own
 * pending timeline change request (the "Undo" on the "Change request sent"
 * toast). Anything else — another person's request, a decided one, another
 * tenant's — is a 404.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { id } = await context.params;
  const ok = await withdrawClientTimelineRequest(guard.ctx, id);
  if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
