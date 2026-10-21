import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { cancelFileRequest, FileRequestError } from '@/db/repositories/client-incorporation';

type RouteContext = { params: Promise<{ id: string; requestId: string }> };

/** DELETE /api/engagements/:id/file-requests/:requestId — the firm withdraws a request (staff only). */
export async function DELETE(_request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id, requestId } = await context.params;
  try {
    await cancelFileRequest(guard.ctx, id, requestId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof FileRequestError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
