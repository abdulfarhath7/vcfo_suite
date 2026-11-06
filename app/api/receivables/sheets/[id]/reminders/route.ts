import { NextResponse } from 'next/server';
import { reminderDesk } from '@/lib/actions/receivables/flows';
import { denied, guardReceivables, receivablesError, type RouteContext } from '../../../_respond';

/**
 * GET /api/receivables/sheets/:id/reminders — the Reminders tab: today's queue (queued on the
 * spot if the job has not run yet), each with the text it will send, and 14 days of history.
 */
export async function GET(_request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  try {
    const { today, rules, queue, history } = await reminderDesk(guard.ctx, id);
    const wire = ({ subjectOverride: _subject, bodyOverride: _body, ...row }: (typeof queue)[number]) => row;
    return NextResponse.json({ today, rules, queue: queue.map(wire), history: history.map(wire) });
  } catch (e) {
    return receivablesError(e);
  }
}
