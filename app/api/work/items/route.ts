import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { getWorkItemDetail } from '@/db/repositories/work-items';
import { canUseWorkTools } from '@/lib/work/work-access';
import { errorText, workErrorStatus } from '@/lib/work/route-errors';

const keySchema = z.string().trim().min(3).max(200);

/**
 * GET /api/work/items?key=<itemKey> — the task drawer's files, activity, "Mark done"
 * verdict and current manager window for one work item (G-16). Staff only, scoped
 * like engagements; an item outside the scope is 404.
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (!canUseWorkTools(guard.ctx.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const key = keySchema.safeParse(new URL(request.url).searchParams.get('key') ?? '');
  if (!key.success) return NextResponse.json({ error: 'invalid_key' }, { status: 400 });
  try {
    const detail = await getWorkItemDetail(guard.ctx, key.data);
    if (!detail) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ detail });
  } catch (err) {
    const message = errorText(err, 'detail_failed');
    return NextResponse.json({ error: message }, { status: workErrorStatus(message) });
  }
}
