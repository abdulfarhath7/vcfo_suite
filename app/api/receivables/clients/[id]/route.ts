import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/api/parse-body';
import { deleteClient, updateClient } from '@/db/repositories/receivables';
import { denied, guardReceivables, receivablesError, type RouteContext } from '../../_respond';
import { clientFields } from '../../_client-fields';

/** PATCH /api/receivables/clients/:id — edit a client (receivables v2); a new partner also moves the client's live invoices. */
const schema = z.object({ name: z.string().trim().min(1, 'client').max(120, 'client').optional(), active: z.boolean().optional(), ...clientFields });

export async function PATCH(request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  const body = await parseJsonBody(request, schema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    return NextResponse.json({ client: await updateClient(guard.ctx, id, body.data) });
  } catch (e) {
    return receivablesError(e);
  }
}

/** DELETE /api/receivables/clients/:id — deletes a client with no invoices (409 `client_has_invoices` otherwise). */
export async function DELETE(_request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  try {
    await deleteClient(guard.ctx, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return receivablesError(e);
  }
}
