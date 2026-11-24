import { NextResponse } from 'next/server';
import { getTallyStatus } from '@/db/repositories/receivables';
import { denied, guardReceivables, receivablesError, type RouteContext } from '../../../_respond';

/** GET /api/receivables/sheets/:id/tally — the Tally connector's status, the sync in progress and the last few syncs. */
export async function GET(_request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  try {
    return NextResponse.json(await getTallyStatus(guard.ctx, id));
  } catch (e) {
    return receivablesError(e);
  }
}
