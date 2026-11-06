import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/api/parse-body';
import { reopenInvoice } from '@/db/repositories/receivables';
import { recordReceipt } from '@/lib/actions/receivables/flows';
import { amount, denied, guardReceivables, isoDate, receivablesError, type RouteContext } from '../../../_respond';

/**
 * POST   /api/receivables/invoices/:id/received — record a full or part payment. `amount` is the
 *        INR credited; a foreign invoice also sends `receivedFc` (the foreign amount that arrived)
 *        and an INR invoice may send `tdsInr`. A foreign invoice marked received gets its awaited
 *        FIRA row at once. A foreign receipt may name `forwardId`, an open forward contract of the
 *        same currency it is delivered against (Phase 10).
 * DELETE /api/receivables/invoices/:id/received — undo: the invoice is open again.
 */
const schema = z.object({
  paidOn: isoDate,
  amount,
  part: z.boolean().optional(),
  receivedFc: z.number().positive('fc_amount').max(1e12, 'fc_amount').nullable().optional(),
  tdsInr: z.number().min(0, 'tds').max(1e12, 'tds').nullable().optional(),
  forwardId: z.string().uuid('forward').nullable().optional(),
});

export async function POST(request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  const body = await parseJsonBody(request, schema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    return NextResponse.json({ invoice: await recordReceipt(guard.ctx, id, body.data) });
  } catch (e) {
    return receivablesError(e);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  try {
    return NextResponse.json({ invoice: await reopenInvoice(guard.ctx, id) });
  } catch (e) {
    return receivablesError(e);
  }
}
