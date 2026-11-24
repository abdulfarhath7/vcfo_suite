import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/api/parse-body';
import { queueSyncJob } from '@/db/repositories/receivables';
import { denied, guardReceivables, isoDate, receivablesError, type RouteContext } from '../../../../_respond';

/**
 * POST /api/receivables/sheets/:id/tally/sync — {type: 'sales' | 'receipts', from, to} queues one
 * sync for the Tally PC. 409 `sync_running` while another sync of the sheet waits or runs, 409
 * `tally_not_connected` when the sheet has no connector.
 */
const schema = z.object({ type: z.enum(['sales', 'receipts'], { message: 'sync_type' }), from: isoDate, to: isoDate });

export async function POST(request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  const body = await parseJsonBody(request, schema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    return NextResponse.json({ job: await queueSyncJob(guard.ctx, id, body.data) }, { status: 201 });
  } catch (e) {
    return receivablesError(e);
  }
}
