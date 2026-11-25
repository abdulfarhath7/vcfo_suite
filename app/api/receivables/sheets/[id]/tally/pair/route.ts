import { NextResponse } from 'next/server';
import { createPairingCode } from '@/db/repositories/receivables';
import { denied, guardReceivables, receivablesError, type RouteContext } from '../../../../_respond';

/** POST /api/receivables/sheets/:id/tally/pair — a new 8-character pairing code, valid 10 minutes, shown once. */
export async function POST(_request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  try {
    return NextResponse.json(await createPairingCode(guard.ctx, id), { status: 201 });
  } catch (e) {
    return receivablesError(e);
  }
}
