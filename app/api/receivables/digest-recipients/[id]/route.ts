import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/api/parse-body';
import { removeDigestRecipient, updateDigestRecipient } from '@/db/repositories/receivables';
import { denied, guardReceivables, receivablesError, type RouteContext } from '../../_respond';

/**
 * PATCH  /api/receivables/digest-recipients/:id — rename, change the address, or switch off.
 * DELETE /api/receivables/digest-recipients/:id — remove the recipient.
 */
const schema = z.object({
  name: z.string().trim().min(1, 'name').max(120, 'name').optional(),
  email: z.string().trim().email('email').max(200, 'email').optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  const body = await parseJsonBody(request, schema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    return NextResponse.json({ recipient: await updateDigestRecipient(guard.ctx, id, body.data) });
  } catch (e) {
    return receivablesError(e);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  try {
    await removeDigestRecipient(guard.ctx, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return receivablesError(e);
  }
}
