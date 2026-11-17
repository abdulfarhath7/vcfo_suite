import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/api/parse-body';
import { deletePartner, updatePartner } from '@/db/repositories/receivables';
import { denied, guardReceivables, receivablesError, type RouteContext } from '../../_respond';

/**
 * PATCH /api/receivables/partners/:id — rename, change the email, deactivate a client partner, or
 * turn their emails on or off (`notifyOnPublish`, and the v2 `notifyNewInvoice` and `notifyRollup`).
 */
const schema = z.object({
  name: z.string().min(1, 'name').max(120, 'name').optional(),
  email: z.string().email('email').max(200, 'email').optional(),
  active: z.boolean().optional(),
  notifyOnPublish: z.boolean().optional(),
  notifyNewInvoice: z.boolean().optional(),
  notifyRollup: z.boolean().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  const body = await parseJsonBody(request, schema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    return NextResponse.json({ partner: await updatePartner(guard.ctx, id, body.data) });
  } catch (e) {
    return receivablesError(e);
  }
}

/** DELETE /api/receivables/partners/:id — deletes a client partner; their clients and invoices show "No partner". */
export async function DELETE(_request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  try {
    await deletePartner(guard.ctx, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return receivablesError(e);
  }
}
