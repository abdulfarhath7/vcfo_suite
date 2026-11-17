import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/api/parse-body';
import { setPartnerClients } from '@/db/repositories/receivables';
import { denied, guardReceivables, receivablesError, type RouteContext } from '../../../_respond';

/**
 * PUT /api/receivables/partners/:id/clients — "Manage clients" (receivables v2): the given clients
 * become exactly this partner's clients; their live invoices follow.
 */
const schema = z.object({ clientIds: z.array(z.string().uuid('client')).max(1000, 'client') });

export async function PUT(request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  const body = await parseJsonBody(request, schema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    return NextResponse.json(await setPartnerClients(guard.ctx, id, body.data.clientIds));
  } catch (e) {
    return receivablesError(e);
  }
}
