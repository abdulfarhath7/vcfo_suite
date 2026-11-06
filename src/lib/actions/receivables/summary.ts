import 'server-only';

import { after } from 'next/server';
import type { AuthContext } from '@/auth/guards';
import { assertOutlookReady } from '@/db/repositories/outlook-connections';
import { getSummarySource, recordSummarySend, type SummarySource } from '@/db/repositories/receivables';
import { todayIst } from '@/lib/receivables/dates';
import { publicPageUrl } from '@/lib/receivables/links';
import type { EmailRecipient } from '@/lib/receivables/model';
import { contactSuggestions, recipientLists, tidyEmailHtml } from '@/lib/receivables/recipients';
import { summaryEmailHtml, summaryEmailSubject } from '@/lib/receivables/summary-email';
import { deliverSummary } from '@/lib/receivables/summary-send';
import { siteUrl } from '@/lib/site-url';

/** The summary email: the same draft and the same send for the dialog and for a card. */

/** The email ready to edit: built from the published version, with the ready-made recipient lists. */
export async function summaryDraft(ctx: AuthContext, sheetId: string) {
  const src = await getSummarySource(ctx, sheetId);
  const today = todayIst();
  return {
    src,
    versionSeq: src.version.seq,
    publishedAt: src.version.publishedAt,
    subject: src.lastSend?.subject.startsWith('RE:') ? `RE: ${summaryEmailSubject(today)}` : summaryEmailSubject(today),
    html: summaryEmailHtml({ rows: src.version.snapshot, today, liveUrl: publicPageUrl(siteUrl(), src.sheet), signerName: ctx.name }),
    lists: recipientLists({ partners: src.partners, rows: src.version.snapshot, today, lastSend: src.lastSend }),
    contacts: contactSuggestions(src.partners, src.lastSend),
    lastSentAt: src.lastSend?.sentAt ?? null,
    lastSendStatus: src.lastSend?.status ?? null,
  };
}

/**
 * Checks the Outlook link, logs the send as `sending`, and sends after the response: one workbook and
 * one Graph call, ending the log row as `sent` or `failed` with the reason.
 */
export async function queueSummary(
  ctx: AuthContext,
  src: SummarySource,
  input: { to: EmailRecipient[]; cc: EmailRecipient[]; bcc: EmailRecipient[]; subject: string; html: string; attachExcel: boolean },
): Promise<{ sendId: string; from: string }> {
  const { msEmail } = await assertOutlookReady(ctx);
  const { to, cc, bcc, subject } = input;
  const { id: sendId } = await recordSummarySend(ctx, src.sheet.id, { versionId: src.version.id, to, cc, bcc, subject, channel: 'outlook', status: 'sending' });
  after(() =>
    deliverSummary(ctx, src.sheet.id, sendId, {
      clientOrgName: src.sheet.clientOrgName,
      snapshot: src.version.snapshot,
      attachExcel: input.attachExcel,
      mail: { to: to.map((r) => r.email), cc: cc.map((r) => r.email), bcc: bcc.map((r) => r.email), subject, html: tidyEmailHtml(input.html) },
    }),
  );
  return { sendId, from: msEmail };
}
