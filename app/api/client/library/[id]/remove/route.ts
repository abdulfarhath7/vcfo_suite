import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { LibraryPortalForbiddenError, removeLibraryItem, restoreLibraryItem } from '@/db/repositories/client-library-portal';

type RouteContext = { params: Promise<{ id: string }> };

async function run(ctx: RouteContext, fn: typeof removeLibraryItem) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  try {
    const ok = await fn(guard.ctx, id);
    if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof LibraryPortalForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

/** POST /api/client/library/[id]/remove — soft "Remove from library" (Undo-able). */
export async function POST(_request: Request, ctx: RouteContext) {
  return run(ctx, removeLibraryItem);
}

/** DELETE /api/client/library/[id]/remove — Undo the removal. */
export async function DELETE(_request: Request, ctx: RouteContext) {
  return run(ctx, restoreLibraryItem);
}
