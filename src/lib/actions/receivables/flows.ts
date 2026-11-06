import 'server-only';

import { after } from 'next/server';
import type { AuthContext } from '@/auth/guards';
import { addSbcNote, createAwaitedFira, getReminderDesk, markReceived, type SbcNoteResult } from '@/db/repositories/receivables';
import { sendEmail } from '@/lib/email/send-email';
import { addDaysIso, todayIst } from '@/lib/receivables/dates';
import { isForeign } from '@/lib/receivables/fx';
import type { ReceiptInput, SheetInvoice } from '@/lib/receivables/model';
import { partnerInvoiceUrl, sbcReplyEmail } from '@/lib/receivables/partner-emails';
import { hitFromRow, reminderDraft } from '@/lib/receivables/reminder-rule';
import { sendDueReminders } from '@/lib/receivables/send-reminders';
import { siteUrl } from '@/lib/site-url';

/** What the routes do around the repository and what a card must do too, so the two cannot differ. */

/**
 * Records a full or part payment. A foreign invoice marked received gets its awaited FIRA row. That
 * row is a follow-up record: the receipt is saved even if it cannot be made now, and the FIRA list
 * creates any missing row when it is next read.
 */
export async function recordReceipt(ctx: AuthContext, invoiceId: string, input: ReceiptInput): Promise<SheetInvoice> {
  const invoice = await markReceived(ctx, invoiceId, input);
  if (invoice.status === 'received' && isForeign({ currency: invoice.currency ?? 'INR' })) {
    await createAwaitedFira(ctx, invoiceId).catch((e) => console.error('[receivables] awaited FIRA not created', e instanceof Error ? e.message : e));
  }
  return invoice;
}

/** An SBC reply on an invoice. The partner's email goes after the response and never fails the reply. */
export async function replyToPartner(ctx: AuthContext, invoiceId: string, text: string): Promise<SbcNoteResult> {
  const result = await addSbcNote(ctx, invoiceId, text);
  if (result.notify) {
    const to = result.notify;
    const mail = sbcReplyEmail({
      partnerName: to.name,
      invoiceLabel: result.invoiceLabel,
      authorName: result.note.authorName,
      text: result.note.text,
      url: partnerInvoiceUrl(siteUrl(), result.invoiceId),
    });
    after(() =>
      sendEmail({ to: to.email, subject: mail.subject, html: mail.html, text: mail.text, purpose: 'receivables.sbc_reply' })
        .then((r) => {
          if (!r.ok && !r.skipped) console.error('[receivables] reply email not sent', r.error);
        })
        .catch((e) => console.error('[receivables] reply email failed', e instanceof Error ? e.message : e)),
    );
  }
  return result;
}

/** The Reminders tab: today's queue (queued on the spot if the job has not run yet), each with the text it will send, and 14 days of history. */
export async function reminderDesk(ctx: AuthContext, sheetId: string) {
  const today = todayIst();
  const { sheet, queue, history } = await getReminderDesk(ctx, sheetId, today, addDaysIso(today, -14));
  const site = siteUrl();
  const toRow = (r: (typeof queue)[number]) => {
    const hit = hitFromRow(r.reminder);
    const draft = reminderDraft(
      { clientName: r.clientName, invoiceNo: r.invoiceNo, amountInr: Number(r.amountInr) || 0, dueDate: String(r.dueDate) },
      hit,
      { name: r.partnerName ?? '' },
      { liveUrl: partnerInvoiceUrl(site, r.reminder.invoiceId), signerName: ctx.name },
    );
    return {
      id: r.reminder.id,
      forDate: String(r.reminder.forDate),
      label: hit.label,
      kind: hit.kind,
      status: r.reminder.status,
      channel: r.reminder.channel,
      error: r.reminder.error,
      sentAt: r.reminder.sentAt,
      clientName: r.clientName,
      invoiceNo: r.invoiceNo,
      amountInr: Number(r.amountInr) || 0,
      dueDate: String(r.dueDate),
      invoiceOpen: r.invoiceStatus === 'open',
      partnerName: r.partnerName,
      partnerEmail: r.partnerEmail,
      subject: r.reminder.subjectOverride ?? draft.subject,
      body: r.reminder.bodyOverride ?? draft.text,
      subjectOverride: r.reminder.subjectOverride,
      bodyOverride: r.reminder.bodyOverride,
      edited: Boolean(r.reminder.subjectOverride || r.reminder.bodyOverride),
    };
  };
  return { today, rules: sheet.reminderRules, queue: queue.map(toRow), history: history.map(toRow) };
}

// shortcut: guards double clicks inside one instance only; a second App Runner instance or the hourly job can still overlap, as before this change.
const sending = new Set<string>();

/**
 * Sends today's queued reminders of a sheet at once. Skipped ones stay skipped. The scope check and
 * the queue happen first; the sending runs after the response, each reminder records its own outcome,
 * and one the work never reached stays queued for the hourly job.
 */
export async function sendRemindersNow(ctx: AuthContext, sheetId: string): Promise<{ pending: number }> {
  const today = todayIst();
  const desk = await getReminderDesk(ctx, sheetId, today, addDaysIso(today, -1));
  const id = desk.sheet.id;
  const pending = desk.queue.filter((r) => r.reminder.status === 'queued' && r.invoiceStatus === 'open').length;
  if (!sending.has(id)) {
    sending.add(id);
    after(() =>
      sendDueReminders(today, { sheetId: id })
        .catch((e) => console.error('[receivables] send now failed', e instanceof Error ? e.message : e))
        .finally(() => sending.delete(id)),
    );
  }
  return { pending };
}
