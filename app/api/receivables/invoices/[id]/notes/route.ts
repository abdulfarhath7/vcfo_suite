import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/api/parse-body';
import { listNotes } from '@/db/repositories/receivables';
import { replyToPartner } from '@/lib/actions/receivables/flows';
import { denied, guardReceivables, receivablesError, type RouteContext } from '../../../_respond';

/**
 * GET  /api/receivables/invoices/:id/notes — the invoice's notes, oldest first (Phase 8).
 * POST /api/receivables/invoices/:id/notes { text } — an SBC reply. The partner gets a short
 *      email with a link to the invoice; that email is best effort and never fails the request.
 * Who may act is decided in the repository: the sheet's own manager and the firm-wide admins.
 */
export async function GET(_request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  try {
    return NextResponse.json({ notes: await listNotes(guard.ctx, id) });
  } catch (e) {
    return receivablesError(e);
  }
}

const schema = z.object({ text: z.string().trim().min(1, 'note').max(2000, 'note') });

export async function POST(request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  const body = await parseJsonBody(request, schema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    return NextResponse.json({ note: (await replyToPartner(guard.ctx, id, body.data.text)).note });
  } catch (e) {
    return receivablesError(e);
  }
}
