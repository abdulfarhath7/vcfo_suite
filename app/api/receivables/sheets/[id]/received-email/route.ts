import { after, NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/api/parse-body';
import { receivedEmailSource, startEmailLog } from '@/db/repositories/receivables';
import { assertOutlookReady } from '@/db/repositories/outlook-connections';
import { partnerOwns } from '@/lib/receivables/co-partners';
import { paymentReceivedEmail } from '@/lib/receivables/email-v2';
import { cleanRecipients, tidyEmailHtml } from '@/lib/receivables/recipients';
import { outlookErrorCode } from '@/lib/receivables/summary-send';
import { deliverLoggedEmail } from '@/lib/receivables/v2-send';
import type { ReceivedEmailDraftDto } from '@/lib/receivables/v2-wire';
import { denied, guardReceivables, receivablesError, type RouteContext } from '../../../_respond';

/**
 * The "Payment received" email (owner, 17 Nov 2026). It is never sent on its own: after Mark
 * received the sheet offers it in a pop-up, and it goes only when the person clicks Send.
 *
 * GET  ?ids=a,b — the draft for those received invoices: subject, body (the SBC table), the
 *      invoices' client partners as the default To, and the partners and clients' billing
 *      addresses to suggest.
 * POST { invoiceIds, to, cc, subject, html } — sends it from the caller's Outlook (202, then
 *      `after`), logged as `payment_received` and followed by the WhatsApp ping to the sender. A
 *      client partner may receive it only when every invoice in it is theirs (400 `partner_elsewhere`).
 */
export async function GET(request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  const ids = (new URL(request.url).searchParams.get('ids') ?? '').split(',').filter(Boolean);
  try {
    const src = await receivedEmailSource(guard.ctx, id, ids);
    if (!src.invoices.length) return NextResponse.json({ error: 'nothing_received' }, { status: 404 });
    // The default To is every partner (lead or second) who owns all of these invoices.
    const owners = src.partners.filter((p) => src.invoices.every((i) => partnerOwns(p.id, i, src.links)));
    const to = owners.map((p) => ({ name: p.name, email: p.email }));
    const mail = paymentReceivedEmail({ recipientName: owners.length === 1 ? owners[0].name : 'Team', senderName: guard.ctx.name || 'SBC', invoices: src.invoices });
    const contacts = [...src.partners.map((p) => ({ name: p.name, email: p.email })), ...src.clientContacts];
    const body: ReceivedEmailDraftDto = { invoiceIds: src.invoices.map((i) => i.id), subject: mail.subject, html: mail.html, to, contacts };
    return NextResponse.json(body);
  } catch (e) {
    return receivablesError(e);
  }
}

const person = z.object({ name: z.string().max(120).default(''), email: z.string().max(200) });
const schema = z.object({
  invoiceIds: z.array(z.string().uuid()).min(1).max(200),
  to: z.array(person).min(1, 'to_required').max(20),
  cc: z.array(person).max(20).default([]),
  subject: z.string().trim().min(1, 'subject_required').max(200),
  html: z.string().min(1, 'body_required').max(300_000),
});

export async function POST(request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  const body = await parseJsonBody(request, schema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  const input = body.data as z.infer<typeof schema>;
  const people = cleanRecipients({ to: input.to, cc: input.cc, bcc: [] });
  if (people.invalid.length) return NextResponse.json({ error: 'bad_email', invalid: people.invalid }, { status: 400 });
  if (!people.to.length) return NextResponse.json({ error: 'to_required' }, { status: 400 });
  try {
    const src = await receivedEmailSource(guard.ctx, id, input.invoiceIds);
    if (!src.invoices.length) return NextResponse.json({ error: 'nothing_received' }, { status: 404 });
    // A client partner never sees another partner's invoice.
    for (const r of [...people.to, ...people.cc]) {
      const p = src.partners.find((x) => x.email.trim().toLowerCase() === r.email.trim().toLowerCase());
      if (p && src.invoices.some((i) => !partnerOwns(p.id, i, src.links))) return NextResponse.json({ error: 'partner_elsewhere' }, { status: 400 });
    }
    await assertOutlookReady(guard.ctx);
    const first = people.to[0];
    const log = await startEmailLog(guard.ctx, {
      sheetId: src.sheetId,
      kind: 'payment_received',
      partnerId: src.invoices[0].partnerId,
      clientId: src.invoices[0].clientId,
      recipientName: first.name || first.email,
      to: people.to.map((r) => r.email),
      cc: people.cc.map((r) => r.email),
      subject: input.subject,
      html: tidyEmailHtml(input.html),
      text: input.subject,
      invoiceIds: src.invoices.map((i) => i.id),
      about: src.invoices.length === 1 ? `${src.invoices[0].invoiceNo ?? 'the payment'} / ${src.invoices[0].clientName}` : `${src.invoices.length} payments received`,
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
