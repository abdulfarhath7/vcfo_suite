import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { BLOCK_TITLE_MAX, deleteTimeBlock, updateTimeBlock } from '@/db/repositories/time-blocks';
import { parseJsonBody } from '@/lib/api/parse-body';
import { canUseWorkTools } from '@/lib/work/work-access';
import { errorText, workErrorStatus } from '@/lib/work/route-errors';

type RouteContext = { params: Promise<{ id: string }> };

const idSchema = z.string().uuid();
const isoSchema = z.string().datetime({ offset: true });
const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(BLOCK_TITLE_MAX).optional(),
    startsAt: isoSchema.optional(),
    endsAt: isoSchema.optional(),
    itemKey: z.string().trim().min(3).max(200).nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'invalid_body' });

/** PATCH /api/work/time-blocks/:id — move or resize (new times), rename or re-link one of the caller's blocks. */
export async function PATCH(request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (!canUseWorkTools(guard.ctx.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  const body = await parseJsonBody(request, patchSchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    const block = await updateTimeBlock(guard.ctx, id, body.data);
    if (!block) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ block });
  } catch (err) {
    const message = errorText(err, 'update_failed');
    return NextResponse.json({ error: message }, { status: workErrorStatus(message) });
  }
}

/** DELETE /api/work/time-blocks/:id — remove one of the caller's blocks. */
export async function DELETE(_request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (!canUseWorkTools(guard.ctx.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  try {
    const ok = await deleteTimeBlock(guard.ctx, id);
    if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = errorText(err, 'delete_failed');
    return NextResponse.json({ error: message }, { status: workErrorStatus(message) });
  }
}
