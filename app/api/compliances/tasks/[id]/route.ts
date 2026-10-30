import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { changeTaskStage, editTask, getTask } from '@/db/repositories/compliance-tasks';
import { complianceError, isoDate, profileId, repeats, stage, urgency, visibility } from '../../_respond';

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/compliances/tasks/:id — one task with everything its page shows (4.3). */
export async function GET(_request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern', 'client');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  try {
    return NextResponse.json({ task: await getTask(guard.ctx, id) });
  } catch (e) {
    return complianceError(e);
  }
}

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('stage'), stage }),
  z.object({
    action: z.literal('edit'),
    name: z.string().min(1).max(120).optional(),
    startDate: isoDate.optional(),
    dueDate: isoDate.optional(),
    urgency: urgency.optional(),
    visibility: visibility.optional(),
    ownerId: profileId.nullable().optional(),
    reviewerId: profileId.nullable().optional(),
    repeats: repeats.optional(),
    remindBefore: z.number().int().min(0).max(90).optional(),
  }),
]);

/** PATCH /api/compliances/tasks/:id — a stage change (staff) or an edit (admin, super admin, manager). */
export async function PATCH(request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    if (body.data.action === 'stage') return NextResponse.json({ task: await changeTaskStage(guard.ctx, id, body.data.stage) });
    const { action: _action, ...edit } = body.data;
    void _action;
    return NextResponse.json({ task: await editTask(guard.ctx, id, edit) });
  } catch (e) {
    return complianceError(e);
  }
}
