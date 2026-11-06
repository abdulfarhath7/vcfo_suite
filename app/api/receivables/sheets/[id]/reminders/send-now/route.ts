import { NextResponse } from 'next/server';
import { sendRemindersNow } from '@/lib/actions/receivables/flows';
import { denied, guardReceivables, receivablesError, type RouteContext } from '../../../../_respond';

/**
 * POST /api/receivables/sheets/:id/reminders/send-now — sends today's queued reminders of this
 * sheet at once instead of waiting for the send hour. Skipped ones stay skipped.
 *
 * The scope check and today's queue happen before the answer; the sending runs after the
 * response (`after` from next/server) and answers 202 { ok, queued, pending }. Each reminder
 * records its own `sent` or `failed` with the reason, and one the work never reached stays
 * queued for the hourly job, so nothing is lost if the process stops.
 */
export async function POST(_request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  try {
    const { pending } = await sendRemindersNow(guard.ctx, id);
    return NextResponse.json({ ok: true, queued: true, pending }, { status: 202 });
  } catch (e) {
    return receivablesError(e);
  }
}
