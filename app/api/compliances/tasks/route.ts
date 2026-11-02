import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { createTask, listTasks } from '@/db/repositories/compliance-tasks';
import { complianceError, isoDate, listParam, profileId, repeats, urgency, visibility } from '../_respond';

/**
 * Non-statutory tasks (docs/ui-port/COMPLIANCE-API.md section 2).
 *
 * GET  /api/compliances/tasks?engagementId=&status=&urgency=&visibility=&activityId=&from=&to=&done=&mine=&includeNa=
 *      — staff in scope; a client its own tasks shared with the client (K-1).
 * POST /api/compliances/tasks — New task (S-5): admin, super admin, manager.
 */
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern', 'client');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const p = new URL(request.url).searchParams;
  const date = (name: string) => {
    const v = p.get(name);
    return v && DATE.test(v) ? v : null;
  };
  const done = p.get('done');
  try {
    const result = await listTasks(guard.ctx, {
      engagementId: p.get('engagementId'),
      status: listParam(p, 'status', ['Not started', 'In progress', 'Waiting', 'Due soon', 'Overdue', 'Done'] as const),
      urgency: listParam(p, 'urgency', ['Low', 'Medium', 'High', 'Critical'] as const),
      visibility: listParam(p, 'visibility', ['firm', 'client', 'both'] as const),
      activityId: p.get('activityId'),
      from: date('from'),
      to: date('to'),
      done: done === '1' ? true : done === '0' ? false : null,
      mine: p.get('mine') === '1',
      includeNa: p.get('includeNa') === '1',
    });
    return NextResponse.json(result);
  } catch (e) {
    return complianceError(e);
  }
}

const createSchema = z.object({
  engagementId: z.string().min(1).max(64),
  activityId: z.string().max(40).nullable(),
  name: z.string().max(120).nullable().optional(),
  startDate: isoDate,
  dueDate: isoDate,
  urgency,
  visibility,
  ownerId: profileId.nullable().optional(),
  reviewerId: profileId.nullable().optional(),
  repeats: repeats.optional(),
  remindBefore: z.number().int().min(0).max(90).optional(),
  checklist: z.array(z.string().max(200)).max(30).optional(),
});

export async function POST(request: Request) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const body = await parseJsonBody(request, createSchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    const task = await createTask(guard.ctx, { ...body.data, activityId: body.data.activityId ?? null });
    return NextResponse.json({ task }, { status: 201 });
  } catch (e) {
    return complianceError(e);
  }
}
