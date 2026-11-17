import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/api/parse-body';
import { approveImportRows } from '@/db/repositories/receivables';
import { queueApprovalEmails } from '@/lib/receivables/v2-send';
import { denied, guardReceivables, isoDate, receivablesError, type RouteContext } from '../../../../_respond';

/**
 * POST /api/receivables/sheets/:id/imports/approve — approves pending rows (new invoices from
 * Tally, amount changes from Tally or staff). Each row may carry a due date, the client's credit
 * days and, for a client with no partner, the partner to give it. Rows that cannot be approved
 * come back in `refused` with a code (`paid_locked`, `no_partner`, `already_exists`). The new invoice
 * and revised emails are queued afterwards (src/lib/receivables/v2-send.ts).
 */
const edit = z.object({
  rowId: z.string().uuid('rows'),
  dueDate: isoDate.optional(),
  creditDays: z.number().int().min(0, 'credit_days').max(365, 'credit_days').optional(),
  partnerId: z.string().uuid('partner').nullable().optional(),
});
const schema = z.object({
  rowIds: z.array(z.string().uuid('rows')).min(1, 'rows').max(2000, 'rows'),
  edits: z.array(edit).max(2000).default([]),
});

export async function POST(request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  const body = await parseJsonBody(request, schema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    const outcome = await approveImportRows(guard.ctx, id, body.data.rowIds, body.data.edits);
    // Emails A and A′ go through the Inngest event (or after the response), never inside approval.
    await queueApprovalEmails({ sheetId: id, approverId: guard.ctx.userId, newInvoiceIds: outcome.newInvoiceIds, revised: outcome.revised });
    return NextResponse.json({ approved: outcome.approved, invoiceIds: outcome.invoiceIds, refused: outcome.refused });
  } catch (e) {
    return receivablesError(e);
  }
}
