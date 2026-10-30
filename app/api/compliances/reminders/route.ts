import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { getReminderSchedule, setReminderSchedule } from '@/db/repositories/compliance-reminder-schedule';
import { complianceError, reminderKey } from '../_respond';

/**
 * The six reminders of one item (COMPLIANCE-MODEL 3.4, D-2.3).
 *
 * GET /api/compliances/reminders?kind=statutory|task&id= — whoever can read the item.
 * PUT /api/compliances/reminders { kind, id, notifyDays?, rows?, reset? } — admin, super admin, manager.
 */
const kind = z.enum(['statutory', 'task']);

export async function GET(request: Request) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern', 'client');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const p = new URL(request.url).searchParams;
  const parsed = z.object({ kind, id: z.string().uuid() }).safeParse({ kind: p.get('kind'), id: p.get('id') });
  if (!parsed.success) return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  try {
    return NextResponse.json(await getReminderSchedule(guard.ctx, parsed.data.kind, parsed.data.id));
  } catch (e) {
    return complianceError(e);
  }
}

const bodySchema = z.object({
  kind,
  id: z.string().uuid(),
  notifyDays: z.number().int().min(0).max(120).optional(),
  rows: z
    .array(z.object({ key: reminderKey, offsetDays: z.number().int().min(-120).max(60).nullable().optional(), enabled: z.boolean().optional() }))
    .max(6)
    .optional(),
  reset: z.boolean().optional(),
});

export async function PUT(request: Request) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    return NextResponse.json(await setReminderSchedule(guard.ctx, body.data));
  } catch (e) {
    return complianceError(e);
  }
}
