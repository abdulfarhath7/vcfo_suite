import { NextResponse } from 'next/server';
import { getEmailLogEntry } from '@/db/repositories/receivables';
import { denied, guardReceivables, receivablesError, type RouteContext } from '../../_respond';

/** GET /api/receivables/email-log/:id — one email in full (its HTML), for the Email log's viewer. */
export async function GET(_request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  try {
    return NextResponse.json(await getEmailLogEntry(guard.ctx, id));
  } catch (e) {
    return receivablesError(e);
  }
}
