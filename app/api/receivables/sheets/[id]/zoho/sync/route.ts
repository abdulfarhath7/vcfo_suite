import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/api/parse-body';
import { queueZohoSheetSync } from '@/db/repositories/receivables';
import { queueZohoSheetSyncRun } from '@/lib/integrations/zoho/run-receivables';
import { denied, guardReceivables, isoDate, receivablesError, type RouteContext } from '../../../../_respond';

/**
 * POST /api/receivables/sheets/:id/zoho/sync — {type: 'sales' | 'receipts', from, to} reads the
 * sheet's Zoho Books organisation and stages the rows for approval. 409 `sync_running`,
 * `zoho_not_set_up` or `zoho_not_connected`.
 */
const schema = z.object({ type: z.enum(['sales', 'receipts'], { message: 'sync_type' }), from: isoDate, to: isoDate });

export async function POST(request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  const body = await parseJsonBody(request, schema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    const job = await queueZohoSheetSync(guard.ctx, id, body.data);
    await queueZohoSheetSyncRun(job.id);
    return NextResponse.json({ job }, { status: 201 });
  } catch (e) {
    return receivablesError(e);
  }
}
