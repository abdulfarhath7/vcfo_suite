import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { getRequestFileUrl } from '@/db/repositories/work-items';
import { canUseWorkTools } from '@/lib/work/work-access';

type RouteContext = { params: Promise<{ id: string }> };

const idSchema = z.string().uuid();

/**
 * GET /api/work/request-files/:id — `{ url, fileName }`, a one-hour signed link to a
 * file the client uploaded against a document request. Staff only; the request must
 * sit on an engagement in the caller's scope.
 */
export async function GET(_request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (!canUseWorkTools(guard.ctx.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  try {
    const file = await getRequestFileUrl(guard.ctx, id);
    if (!file) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json(file);
  } catch {
    return NextResponse.json({ error: 'signed_url_failed' }, { status: 500 });
  }
}
