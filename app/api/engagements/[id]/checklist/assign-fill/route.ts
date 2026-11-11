import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { publicErrorMessage } from '@/lib/api-error';
import { assignStepFill } from '@/lib/checklist/assign-fill';

const bodySchema = z.object({
  itemId: z.string().trim().min(1),
  to: z.enum(['lead', 'client']),
});

/**
 * POST /api/engagements/:id/checklist/assign-fill (DR-04). A manager or admin hands a
 * client-owned step (Proposed directors) to the project lead ("Assign to Lead"), or back to the
 * client ("Assign to Client"). The lead and client accounts are refused. The change is recorded in
 * the audit log and the lead gets an in-app notification.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  const { id } = await context.params;
  try {
    const checklistState = await assignStepFill(guard.ctx, id, body.data.itemId, body.data.to);
    return NextResponse.json({ ok: true, checklistState });
  } catch (err) {
    const message = publicErrorMessage(err, 'assign_failed');
    const status = message === 'step_not_assignable' ? 400 : message.includes('not found') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
