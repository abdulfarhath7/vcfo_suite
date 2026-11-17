import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/api/parse-body';
import { addClient } from '@/db/repositories/receivables';
import { denied, guardReceivables, receivablesError, type RouteContext } from '../../../_respond';
import { clientFields } from '../../../_client-fields';

/** POST /api/receivables/sheets/:id/clients — add a client (receivables v2): name, partner, credit days, billing email and CC, GSTIN. */
const schema = z.object({ name: z.string().trim().min(1, 'client').max(120, 'client'), ...clientFields });

export async function POST(request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  const body = await parseJsonBody(request, schema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    return NextResponse.json({ client: await addClient(guard.ctx, id, body.data) }, { status: 201 });
  } catch (e) {
    return receivablesError(e);
  }
}
