import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { decideWindowRequest, withdrawWindowRequest } from '@/db/repositories/item-window-requests';
import { parseJsonBody } from '@/lib/api/parse-body';
import { canUseWorkTools } from '@/lib/work/work-access';
import { errorText, workErrorStatus } from '@/lib/work/route-errors';

type RouteContext = { params: Promise<{ id: string }> };

const idSchema = z.string().uuid();
const patchSchema = z.object({
  action: z.enum(['approve', 'reject', 'withdraw']),
  note: z.string().max(1000).nullable().optional(),
});

/**
 * PATCH /api/work/window-requests/:id
 *   { action: 'approve' }            manager / admin: apply the asked window
 *   { action: 'reject', note }       manager / admin: refuse, note required
 *   { action: 'withdraw' }           the lead who asked, while pending
 */
export async function PATCH(request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (!canUseWorkTools(guard.ctx.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  const body = await parseJsonBody(request, patchSchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    const row =
      body.data.action === 'withdraw'
        ? await withdrawWindowRequest(guard.ctx, id)
        : await decideWindowRequest(guard.ctx, id, { action: body.data.action, note: body.data.note });
    if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ request: { id: row.id, status: row.status } });
  } catch (err) {
    const message = errorText(err, 'decide_failed');
    return NextResponse.json({ error: message }, { status: workErrorStatus(message) });
  }
}
