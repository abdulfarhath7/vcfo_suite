import 'server-only';
import type { AuthContext } from '@/auth/guards';
import { finishSummarySend, getSignName, systemFinishEmailLog, systemRecordSentReceipts } from '@/db/repositories/receivables';
import { emails, fromEmailOf, notifyTeam } from './team-notify';
import { sendMailViaOutlook } from '@/db/repositories/outlook-connections';
import type { EmailRecipient, Partner } from './model';
import { z } from 'zod';
import { DEFAULT_DEPOSITS_TITLE, DEPOSIT_LIMITS, type DepositsSection } from './deposits';

/**
 * The summary email's slow part (docs/specs/receivables/PLAN.md, Phase 4). The send-summary route
 * checks everything that can fail fast, logs the send as `sending`, answers 202 and hands this to
 * `after`. It sends through Graph (never with an Excel attachment) and marks the log row `sent` or
 * `failed` with a reason code the dialog can show.
 */

/** Outlook errors the manager can act on; anything else is a plain send failure. */
export function outlookErrorCode(e: unknown): 'outlook_not_connected' | 'outlook_reconnect' | null {
  const message = e instanceof Error ? e.message : '';
  if (message === 'outlook_not_connected') return 'outlook_not_connected';
  if (message.includes('invalid_grant') || message.includes('refresh')) return 'outlook_reconnect';
  return null;
}

/** `invoiceIds`: the invoices in the body; the received ones are remembered as sent to these people. */
/** `logId`: the email's row in the Email log, marked sent or failed as it goes. */
export type SummaryMail = { to: string[]; cc: string[]; bcc: string[]; subject: string; html: string; invoiceIds?: string[]; logId?: string };

/**
 * Checks one Send email batch so a client partner never sees another partner's invoices (owner,
 * 17 Nov 2026). The dialog makes one email per person: a partner email (only that partner's
 * clients) or a full email (the whole sheet, for leaders and anyone else). Rules:
 *  - a partner email goes To exactly that partner, alone;
 *  - no client partner's address may appear anywhere else: not in Cc of any email, and not on a
 *    full email.
 * With `leaders` (the receivables update, owner 23 Nov 2026) the batch may go to the sheet's
 * leaders only: no partner email, and every To and Cc address is an active leader, or `leaders_only`.
 * Returns the mails to send, or the first rule broken as an error code the dialog shows.
 */
export function checkSummaryEmails(
  emails: Array<{ kind: 'partner' | 'full'; partnerId?: string; to: EmailRecipient[]; cc: EmailRecipient[]; subject: string; html: string; invoiceIds?: string[] }>,
  partners: Partner[],
  leaders?: EmailRecipient[],
): { ok: true; mails: SummaryMail[] } | { ok: false; error: 'partner_unknown' | 'partner_to' | 'partner_elsewhere' | 'to_required' | 'leaders_only' } {
  const byEmail = new Map(partners.map((p) => [p.email.trim().toLowerCase(), p]));
  if (leaders) {
    const allowed = new Set(leaders.map((l) => l.email.trim().toLowerCase()));
    if (emails.some((e) => e.kind === 'partner' || [...e.to, ...e.cc].some((r) => !allowed.has(r.email.trim().toLowerCase())))) return { ok: false, error: 'leaders_only' };
  }
  const mails: SummaryMail[] = [];
  for (const e of emails) {
    const to = e.to.map((r) => r.email.trim());
    const cc = e.cc.map((r) => r.email.trim()).filter((x) => !to.some((t) => t.toLowerCase() === x.toLowerCase()));
    if (!to.length) return { ok: false, error: 'to_required' };
    if (e.kind === 'partner') {
      const p = partners.find((x) => x.id === e.partnerId);
      if (!p) return { ok: false, error: 'partner_unknown' };
      if (to.length !== 1 || to[0].toLowerCase() !== p.email.trim().toLowerCase()) return { ok: false, error: 'partner_to' };
      if (cc.some((x) => byEmail.has(x.toLowerCase()))) return { ok: false, error: 'partner_elsewhere' };
    } else if ([...to, ...cc].some((x) => byEmail.has(x.toLowerCase()))) {
      return { ok: false, error: 'partner_elsewhere' };
    }
    mails.push({ to, cc, bcc: [], subject: e.subject.trim(), html: e.html, invoiceIds: e.invoiceIds });
  }
  return { ok: true, mails };
}

/*
 * The security deposits section of the receivables update (owner, 23 Nov 2026), as the send
 * request carries it: title up to 80 characters, up to 50 rows, each text cell trimmed and up to
 * 200 characters (the due column 300), the amount a number from 0 to 1e13 or null. Nothing else.
 */
const cell = (max: number) => z.string().trim().max(max, 'deposits_cell_too_long');
const depositRow = z.strictObject({
  client: cell(DEPOSIT_LIMITS.cell),
  status: cell(DEPOSIT_LIMITS.cell),
  eta: cell(DEPOSIT_LIMITS.cell),
  totalInr: z.number().nonnegative('deposits_bad_amount').max(DEPOSIT_LIMITS.amount, 'deposits_bad_amount').nullable(),
  due: cell(DEPOSIT_LIMITS.due),
});
const depositsSchema = z.strictObject({
  title: z.string().trim().max(DEPOSIT_LIMITS.title, 'deposits_title_too_long'),
  rows: z.array(depositRow).max(DEPOSIT_LIMITS.rows, 'deposits_too_many_rows'),
});

/**
 * The deposits of a request, checked: null when there are none (or only empty rows), or the first
 * broken rule as a code. A wrong type anywhere is `deposits_invalid`.
 */
export function checkDeposits(raw: unknown): { ok: true; deposits: DepositsSection | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, deposits: null };
  const parsed = depositsSchema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? '';
    return { ok: false, error: message.startsWith('deposits_') ? message : 'deposits_invalid' };
  }
  const rows = parsed.data.rows
    .map((r) => ({ client: r.client, status: r.status, eta: r.eta, totalInr: r.totalInr ?? null, due: r.due }))
    .filter((r) => r.client || r.status || r.eta || r.due || r.totalInr !== null);
  return { ok: true, deposits: rows.length ? { title: parsed.data.title || DEFAULT_DEPOSITS_TITLE, rows } : null };
}

/** The slow part, after the response: one Graph call per email, then the outcome on the log row. */
export async function deliverSummary(ctx: AuthContext, sheetId: string, sendId: string, job: { mails: SummaryMail[] }): Promise<void> {
  let done = 0;
  try {
    // The firm never sends an Excel file attached to an email (owner, 17 Nov 2026).
    for (const mail of job.mails) {
      await sendMailViaOutlook(ctx, mail);
      done += 1;
      if (mail.logId) await systemFinishEmailLog(mail.logId, { status: 'sent' }).catch(() => undefined);
      // The received invoices in it are never sent to these people again (owner, 18 Nov 2026).
      if (mail.invoiceIds?.length)
        await systemRecordSentReceipts(sheetId, mail.invoiceIds, [...mail.to, ...mail.cc], 'summary').catch((e) =>
          console.error('[receivables] could not remember the sent invoices', e instanceof Error ? e.message : e),
        );
    }
    await finishSummarySend(ctx, sheetId, sendId, { status: 'sent' });
    const who = (await getSignName(ctx).catch(() => null)) || 'Someone';
    await notifyTeam(sheetId, `${who} sent the receivables email: ${emails(job.mails.length)}`, {
      from: await fromEmailOf(ctx),
      to: job.mails.flatMap((m) => [...m.to, ...m.cc]),
      exceptUserId: ctx.userId,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[receivables] summary send failed', message.slice(0, 200));
    // The email that failed and the ones after it, which were never tried, show as failed in the log.
    const code = outlookErrorCode(e) ?? 'send_failed';
    for (const mail of job.mails.slice(done)) if (mail.logId) await systemFinishEmailLog(mail.logId, { status: 'failed', error: code }).catch(() => undefined);
    await finishSummarySend(ctx, sheetId, sendId, { status: 'failed', error: outlookErrorCode(e) ?? 'send_failed' }).catch((err) =>
      console.error('[receivables] could not record the failed send', err instanceof Error ? err.message : err),
    );
  }
}
