import { after, NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/api/parse-body';
import { cleanRecipients, tidyEmailHtml } from '@/lib/receivables/recipients';
import { depositsSectionHtml, withDepositsSection } from '@/lib/receivables/summary-email';
import { checkSummaryEmails, deliverSummary, mayCarryDeposits, outlookErrorCode } from '@/lib/receivables/summary-send';
import { getSummarySendStatus, getSummarySource, listDeposits, listDigestRecipients, recordSummarySend, startEmailLog } from '@/db/repositories/receivables';
import { DEFAULT_DEPOSITS_TITLE } from '@/lib/receivables/deposits';
import { assertOutlookReady } from '@/db/repositories/outlook-connections';
import { denied, guardReceivables, receivablesError, type RouteContext } from '../../../_respond';

/**
 * POST /api/receivables/sheets/:id/send-summary — Send email, from the sender's own Outlook. The
 * The
 * dialog sends one email per person (owner, 17 Nov 2026): a client partner's email holds only the
 * invoices of that partner's clients; a leader's (or anyone else's) holds the whole sheet. Each is
 * edited in the dialog. `checkSummaryEmails` refuses any batch where a partner would see another
 * partner's invoices (400 `partner_to` or `partner_elsewhere`). No Excel file is ever attached.
 *
 * Everything that can fail fast is checked before the answer: the input, the addresses, the
 * published version and the Outlook link (409 outlook_not_connected or outlook_reconnect). The
 * batch is then logged as one `sending` row and the route answers 202 { ok, queued, sendId }. The
 * Graph calls run after the response (`after` from next/server); the row ends `sent` or `failed`.
 *
 * `withDeposits` (owner, 23 Nov 2026): the leaders' email carries the sheet's security deposits
 * table (kept on the Sheet tab). The section is drawn here from the saved rows, replacing whatever
 * deposits block the body holds, and only into a whole-sheet email whose every To and Cc address
 * is an active leader of the sheet. Any other email that holds the block is refused
 * (400 `deposits_leaders_only`); the Collections report refuses it (400 `deposits_summary_only`).
 *
 * GET ?send=<sendId> — the state of that send, which the dialog polls to show the outcome.
 */
const person = z.object({ name: z.string().max(120).default(''), email: z.string().max(200) });
const email = z.object({
  kind: z.enum(['partner', 'full']),
  partnerId: z.string().uuid().optional(),
  to: z.array(person).min(1, 'to_required').max(50),
  cc: z.array(person).max(50).default([]),
  subject: z.string().trim().min(1, 'subject_required').max(200),
  html: z.string().min(1, 'body_required').max(300_000),
  /** The invoices in the body; received ones already sent to these people stop the send. */
  invoiceIds: z.array(z.string().uuid()).max(1000).optional(),
});
/** `report`: the receivables update (the Sheet tab) or the Collections report (the Collections tab). */
const schema = z.object({
  emails: z.array(email).min(1, 'to_required').max(60),
  report: z.enum(['summary', 'collections']).default('summary'),
  /** True when the leaders' email carries the sheet's security deposits table. */
  withDeposits: z.boolean().default(false),
});

export async function POST(request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  const body = await parseJsonBody(request, schema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  const input = body.data as z.infer<typeof schema>;
  // The Collections report lists received invoices as a record, not to tell anyone again, so it
  // neither checks nor writes the "already sent" receipts.
  const collections = input.report === 'collections';
  // The security deposits belong to the receivables update only, and there to the leaders only.
  if (collections && input.withDeposits) return NextResponse.json({ error: 'deposits_summary_only' }, { status: 400 });
  // Each email's addresses: valid, each once.
  const emails = [];
  for (const e of input.emails) {
    const people = cleanRecipients({ to: e.to, cc: e.cc, bcc: [] });
    if (people.invalid.length) return NextResponse.json({ error: 'bad_email', invalid: people.invalid }, { status: 400 });
    emails.push({ ...e, to: people.to, cc: people.cc });
  }
  if (collections) for (const e of emails) e.invoiceIds = undefined;
  try {
    const src = await getSummarySource(guard.ctx, id);
    // The section is drawn from the sheet's saved deposits table, never from the request.
    const saved = input.withDeposits ? await listDeposits(guard.ctx, id) : [];
    const section = depositsSectionHtml(saved.length ? { title: DEFAULT_DEPOSITS_TITLE, rows: saved } : null);
    // The deposits go to the leaders only (owner, 23 Nov 2026): into the whole-sheet email whose
    // every address is an active leader. A partner's or anyone else's email never gets them.
    const leaders = section ? (await listDigestRecipients(guard.ctx, id)).filter((r) => r.active) : [];
    for (const e of emails) {
      const carries = Boolean(section) && mayCarryDeposits(e, leaders);
      if (section && !carries && e.html.includes('<!--deposits-->')) return NextResponse.json({ error: 'deposits_leaders_only' }, { status: 400 });
      e.html = tidyEmailHtml(collections ? e.html : withDepositsSection(e.html, carries ? section : ''));
    }
    const checked = checkSummaryEmails(emails, src.partners);
    if (checked.ok === false) return NextResponse.json({ error: checked.error }, { status: 400 });
    // An invoice a person already got is only a warning in the pop-up; it never stops a send (owner, 23 Nov 2026).
    const { msEmail } = await assertOutlookReady(guard.ctx);
    const to = emails.flatMap((e) => e.to);
    const cc = emails.flatMap((e) => e.cc);
    const { id: sendId } = await recordSummarySend(guard.ctx, id, { versionId: src.version.id, to, cc, bcc: [], subject: emails[0].subject, channel: 'outlook', status: 'sending' });
    // Each email also goes into the Email log (owner, 19 Nov 2026), with its HTML, as `sending`.
    const mails = [];
    for (const [i, mail] of checked.mails.entries()) {
      const e = emails[i]!;
      const log = await startEmailLog(guard.ctx, {
        sheetId: id,
        kind: collections ? 'collections' : 'summary',
        partnerId: e.kind === 'partner' ? (e.partnerId ?? null) : null,
        recipientName: e.to.map((r) => r.name || r.email).join(', ').slice(0, 200),
        to: mail.to,
        cc: mail.cc,
        subject: mail.subject,
        html: mail.html,
        text: mail.subject,
        invoiceIds: mail.invoiceIds ?? [],
        about: collections ? 'Collections report' : 'Receivables update',
        status: 'sending',
      });
      mails.push({ ...mail, logId: log.id });
    }
    const ctx = guard.ctx;
    after(() => deliverSummary(ctx, id, sendId, { mails }));
    return NextResponse.json({ ok: true, queued: true, sendId, from: msEmail, emails: checked.mails.length, to: to.length, cc: cc.length, bcc: 0 }, { status: 202 });
  } catch (e) {
    const code = outlookErrorCode(e);
    if (code) return NextResponse.json({ error: code }, { status: 409 });
    return receivablesError(e);
  }
}

export async function GET(request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  const sendId = new URL(request.url).searchParams.get('send') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(sendId)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  try {
    return NextResponse.json(await getSummarySendStatus(guard.ctx, id, sendId));
  } catch (e) {
    return receivablesError(e);
  }
}
