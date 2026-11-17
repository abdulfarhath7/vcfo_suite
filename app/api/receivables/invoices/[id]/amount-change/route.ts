import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/api/parse-body';
import { requestAmountChange } from '@/db/repositories/receivables';
import { amount, denied, guardReceivables, receivablesError, type RouteContext } from '../../../_respond';

/**
 * POST /api/receivables/invoices/:id/amount-change — a staff amount change (for example from a
 * client partner's email). It does not change the invoice: it waits in the approval panel, and
 * approving it sets the amount, adds a revision and sends the revised email. A received or
 * part-paid invoice answers 409 `paid_locked`.
 */
const schema = z.object({ amountInr: amount, reason: z.string().trim().min(1, 'reason').max(300, 'reason') });

export async function POST(request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  const body = await parseJsonBody(request, schema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    return NextResponse.json({ row: await requestAmountChange(guard.ctx, id, body.data) }, { status: 201 });
  } catch (e) {
    return receivablesError(e);
  }
}
