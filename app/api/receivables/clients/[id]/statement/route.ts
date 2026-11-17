import { after, NextResponse } from 'next/server';
import { clientStatementSource, startEmailLog } from '@/db/repositories/receivables';
import { assertOutlookReady } from '@/db/repositories/outlook-connections';
import { todayIst } from '@/lib/receivables/dates';
import { clientStatementEmail } from '@/lib/receivables/email-v2';
import { outlookErrorCode } from '@/lib/receivables/summary-send';
import { deliverLoggedEmail } from '@/lib/receivables/v2-send';
import { denied, guardReceivables, receivablesError, type RouteContext } from '../../../_respond';

/**
 * POST /api/receivables/clients/:id/statement — "Send statement" (email D, receivables v2). Never
 * automatic. The client's open invoices go in one table to its billing email and CC, from the
 * clicker's own Outlook. Everything that can fail fast (no billing email, nothing open, no Outlook)
 * answers at once; the send is then logged as `sending`, the route answers 202, and the Graph call
 * and the WhatsApp ping run after the response (`after`, like send-summary).
 */
export async function POST(_request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  try {
    const src = await clientStatementSource(guard.ctx, id);
    await assertOutlookReady(guard.ctx);
    const mail = clientStatementEmail({ clientName: src.client.name, senderName: guard.ctx.name || 'SBC', invoices: src.invoices, today: todayIst() });
    const log = await startEmailLog(guard.ctx, {
      sheetId: src.sheetId,
      kind: 'client_statement',
      clientId: src.client.id,
      recipientName: src.client.name,
      to: [src.client.billingEmail],
      cc: src.client.billingCc,
      ...mail,
      invoiceIds: src.invoices.map((i) => i.id),
      about: `the statement of ${src.client.name}`,
    });
    const ctx = guard.ctx;
    after(() => deliverLoggedEmail(log.id, { ctx }).then(() => undefined));
    return NextResponse.json({ ok: true, queued: true, logId: log.id }, { status: 202 });
  } catch (e) {
    const code = outlookErrorCode(e);
    if (code) return NextResponse.json({ error: code }, { status: 409 });
    return receivablesError(e);
  }
}
