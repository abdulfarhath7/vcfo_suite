import { NextResponse } from 'next/server';
import { revokeConnector } from '@/db/repositories/receivables';
import { denied, guardReceivables, receivablesError, type RouteContext } from '../../../../_respond';

/** POST /api/receivables/sheets/:id/tally/revoke — Disconnect: the connector's token stops working. */
export async function POST(_request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  try {
    return NextResponse.json(await revokeConnector(guard.ctx, id));
  } catch (e) {
    return receivablesError(e);
  }
}
