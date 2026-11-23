import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/api/parse-body';
import { checkDeposits } from '@/lib/receivables/summary-send';
import { listDeposits, saveDeposits } from '@/db/repositories/receivables';
import { denied, guardReceivables, receivablesError, type RouteContext } from '../../../_respond';

/**
 * The sheet's security deposits table (owner, 23 Nov 2026): Client, Status, ETA for closure,
 * Total SD in INR and SD due now/post signing.
 * GET /api/receivables/sheets/:id/deposits — the saved rows.
 * PUT — replaces the table with `rows` (up to 50; 400 `deposits_*` when a rule is broken). Empty
 * rows are left out.
 */
const schema = z.object({ rows: z.unknown() });

export async function GET(_request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  try {
    return NextResponse.json({ rows: await listDeposits(guard.ctx, id) });
  } catch (e) {
    return receivablesError(e);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  const body = await parseJsonBody(request, schema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  const checked = checkDeposits({ title: '', rows: (body.data as z.infer<typeof schema>).rows });
  if (checked.ok === false) return NextResponse.json({ error: checked.error }, { status: 400 });
  try {
    return NextResponse.json({ rows: await saveDeposits(guard.ctx, id, checked.deposits?.rows ?? []) });
  } catch (e) {
    return receivablesError(e);
  }
}
