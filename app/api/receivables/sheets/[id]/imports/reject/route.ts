import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/api/parse-body';
import { rejectImportRows } from '@/db/repositories/receivables';
import { denied, guardReceivables, receivablesError, type RouteContext } from '../../../../_respond';

/** POST /api/receivables/sheets/:id/imports/reject — rejects pending rows; the invoices do not change. */
const schema = z.object({ rowIds: z.array(z.string().uuid('rows')).min(1, 'rows').max(2000, 'rows') });

export async function POST(request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  const body = await parseJsonBody(request, schema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    return NextResponse.json(await rejectImportRows(guard.ctx, id, body.data.rowIds));
  } catch (e) {
    return receivablesError(e);
  }
}
