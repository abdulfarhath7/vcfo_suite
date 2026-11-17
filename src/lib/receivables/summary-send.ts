import 'server-only';
import type { AuthContext } from '@/auth/guards';
import { finishSummarySend } from '@/db/repositories/receivables';
import { sendMailViaOutlook } from '@/db/repositories/outlook-connections';
import type { EmailRecipient, Partner, SnapshotRow } from './model';
import { summaryEmailHtml } from './summary-email';

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

export type SummaryMail = { to: string[]; cc: string[]; bcc: string[]; subject: string; html: string };

/**
 * Splits one summary send so a client partner never sees another partner's invoices (owner,
 * 17 Nov 2026). Every address in To, Cc or Bcc that belongs to a client partner of the sheet is
 * taken out of the shared email and gets an email of its own, built from the published version
 * with only that partner's invoices (a partner with none gets nothing). Everyone else (SBC staff,
 * leadership) gets the shared email with the edited body, which may show every invoice.
 */
export function splitSummaryForPartners(input: {
  people: { to: EmailRecipient[]; cc: EmailRecipient[]; bcc: EmailRecipient[] };
  partners: Partner[];
  snapshot: SnapshotRow[];
  today: string;
  signerName: string;
  subject: string;
  html: string;
}): SummaryMail[] {
  const byEmail = new Map(input.partners.map((p) => [p.email.trim().toLowerCase(), p]));
  const partnerOf = (r: EmailRecipient) => byEmail.get(r.email.trim().toLowerCase());
  const keep = (list: EmailRecipient[]) => list.filter((r) => !partnerOf(r)).map((r) => r.email);
  const mails: SummaryMail[] = [];
  const shared = { to: keep(input.people.to), cc: keep(input.people.cc), bcc: keep(input.people.bcc) };
  if (shared.to.length || shared.cc.length || shared.bcc.length) {
    // A shared email with only Cc or Bcc left still needs a To: the first Cc moves up.
    const to = shared.to.length ? shared.to : shared.cc.length ? shared.cc.slice(0, 1) : shared.bcc.slice(0, 1);
    mails.push({
      to,
      cc: shared.cc.filter((e) => !to.includes(e)),
      bcc: shared.bcc.filter((e) => !to.includes(e)),
      subject: input.subject,
      html: input.html,
    });
  }
  const seen = new Set<string>();
  for (const r of [...input.people.to, ...input.people.cc, ...input.people.bcc]) {
    const p = partnerOf(r);
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    if (!input.snapshot.some((row) => row.partnerSlug === p.slug)) continue;
    mails.push({
      to: [p.email],
      cc: [],
      bcc: [],
      subject: input.subject,
      html: summaryEmailHtml({ rows: input.snapshot, today: input.today, liveUrl: '', signerName: input.signerName, partnerSlug: p.slug }),
    });
  }
  return mails;
}

/** The slow part, after the response: one Graph call per email, then the outcome on the log row. */
export async function deliverSummary(ctx: AuthContext, sheetId: string, sendId: string, job: { mails: SummaryMail[] }): Promise<void> {
  try {
    // The firm never sends an Excel file attached to an email (owner, 17 Nov 2026).
    for (const mail of job.mails) await sendMailViaOutlook(ctx, mail);
    await finishSummarySend(ctx, sheetId, sendId, { status: 'sent' });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[receivables] summary send failed', message.slice(0, 200));
    await finishSummarySend(ctx, sheetId, sendId, { status: 'failed', error: outlookErrorCode(e) ?? 'send_failed' }).catch((err) =>
      console.error('[receivables] could not record the failed send', err instanceof Error ? err.message : err),
    );
  }
}
