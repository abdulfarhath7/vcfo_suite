import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { deletePlannerBlock, updatePlannerBlock } from '@/db/repositories/planner-blocks';
import { plannerError } from '@/lib/planner-blocks-response';

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/planner/blocks/:id — move or resize a block (day, startMin, endMin, title). */
export async function PATCH(request: Request, ctx: Ctx) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  try {
    const block = await updatePlannerBlock(guard.ctx, id, body);
    if (!block) return plannerError(new Error('not_found'));
    return NextResponse.json({ block });
  } catch (err) {
    return plannerError(err);
  }
}

/** DELETE /api/planner/blocks/:id */
export async function DELETE(_request: Request, ctx: Ctx) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await ctx.params;
  try {
    const ok = await deletePlannerBlock(guard.ctx, id);
    if (!ok) return plannerError(new Error('not_found'));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return plannerError(err);
  }
}
