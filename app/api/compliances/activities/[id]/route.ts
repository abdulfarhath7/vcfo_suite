import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { updateActivity } from '@/db/repositories/compliance-activities';
import { complianceError, visibility } from '../../_respond';

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  notifyDays: z.number().int().min(0).max(120).optional(),
  ownerRole: z.string().max(120).optional(),
  reviewerRole: z.string().max(120).optional(),
  visibility: visibility.optional(),
  confirmed: z.boolean().optional(),
});

/** PATCH /api/compliances/activities/:id — admin and super admin edit one activity or confirm its open point. */
export async function PATCH(request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    return NextResponse.json({ activity: await updateActivity(guard.ctx, decodeURIComponent(id), body.data) });
  } catch (e) {
    return complianceError(e);
  }
}
