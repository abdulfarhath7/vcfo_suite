import { after, NextResponse } from 'next/server';
import { retryEmailLog } from '@/db/repositories/receivables';
import { assertOutlookReady } from '@/db/repositories/outlook-connections';
import { outlookErrorCode } from '@/lib/receivables/summary-send';
import { deliverLoggedEmail } from '@/lib/receivables/v2-send';
import { denied, guardReceivables, receivablesError, type RouteContext } from '../../../_respond';

/**
 * POST /api/receivables/email-log/:id/retry — sends a failed receivables v2 email again, the same
 * message, now from the clicker's Outlook. Answers 202; the send runs after the response.
 */
export async function POST(_request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  try {
    await assertOutlookReady(guard.ctx);
    const log = await retryEmailLog(guard.ctx, id);
    const ctx = guard.ctx;
    after(() => deliverLoggedEmail(log.id, { ctx }).then(() => undefined));
    return NextResponse.json({ ok: true, queued: true }, { status: 202 });
  } catch (e) {
    const code = outlookErrorCode(e);
    if (code) return NextResponse.json({ error: code }, { status: 409 });
    return receivablesError(e);
  }
}
