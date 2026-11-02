import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { deleteChecklistItem, setChecklistItem } from '@/db/repositories/compliance-tasks';
import { complianceError } from '../../../../_respond';

type RouteContext = { params: Promise<{ id: string; itemId: string }> };

const bodySchema = z.object({ done: z.boolean() });

/** PATCH /api/compliances/tasks/:id/checklist/:itemId — tick or untick (staff). */
export async function PATCH(request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id, itemId } = await context.params;
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    return NextResponse.json({ item: await setChecklistItem(guard.ctx, id, itemId, body.data.done) });
  } catch (e) {
    return complianceError(e);
  }
}

/** DELETE /api/compliances/tasks/:id/checklist/:itemId — remove a subtask (admin, super admin, manager). */
export async function DELETE(_request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id, itemId } = await context.params;
  try {
    await deleteChecklistItem(guard.ctx, id, itemId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return complianceError(e);
  }
}
