import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { CHECKLIST_LABEL_MAX, deleteChecklistItem, updateChecklistItem } from '@/db/repositories/work-checklist';
import { parseJsonBody } from '@/lib/api/parse-body';
import { canUseWorkTools } from '@/lib/work/work-access';
import { errorText, workErrorStatus } from '@/lib/work/route-errors';

type RouteContext = { params: Promise<{ id: string }> };

const idSchema = z.string().uuid();
const patchSchema = z
  .object({ label: z.string().trim().min(1).max(CHECKLIST_LABEL_MAX).optional(), done: z.boolean().optional() })
  .refine((v) => v.label !== undefined || v.done !== undefined, { message: 'invalid_body' });

/** PATCH /api/work/checklist/:id { label?, done? } — tick or rename one of the caller's lines. */
export async function PATCH(request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (!canUseWorkTools(guard.ctx.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  const body = await parseJsonBody(request, patchSchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    const item = await updateChecklistItem(guard.ctx, id, body.data);
    if (!item) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ item });
  } catch (err) {
    const message = errorText(err, 'update_failed');
    return NextResponse.json({ error: message }, { status: workErrorStatus(message) });
  }
}

/** DELETE /api/work/checklist/:id — remove one of the caller's lines. */
export async function DELETE(_request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (!canUseWorkTools(guard.ctx.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  try {
    const ok = await deleteChecklistItem(guard.ctx, id);
    if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = errorText(err, 'delete_failed');
    return NextResponse.json({ error: message }, { status: workErrorStatus(message) });
  }
}
