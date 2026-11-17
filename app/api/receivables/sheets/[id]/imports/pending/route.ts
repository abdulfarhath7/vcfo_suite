import { NextResponse } from 'next/server';
import { getPendingImports } from '@/db/repositories/receivables';
import { denied, guardReceivables, receivablesError, type RouteContext } from '../../../../_respond';

/** GET /api/receivables/sheets/:id/imports/pending — the approval panel: the pending Tally batch and every pending row. */
export async function GET(_request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  try {
    return NextResponse.json(await getPendingImports(guard.ctx, id));
  } catch (e) {
    return receivablesError(e);
  }
}
