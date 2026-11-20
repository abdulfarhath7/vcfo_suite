import 'server-only';
import { after } from 'next/server';
import type { AuthContext } from '@/auth/guards';
import {
  systemDigestRecipients,
  systemFinishEmailLog,
  systemGetEmailLog,
  systemInvoicesById,
  systemLastRollupDate,
  systemOpenInvoices,
  systemSetEmailWhatsApp,
  systemSheetEmailSettings,
  systemSheetPartners,
  systemStaffName,
  systemTemplatesFor,
  systemReplaceAwaiting,
  systemStartEmailLog,
  type EmailInvoiceRow,
  systemCoPartnerLinks,
  type SheetEmailSettings,
} from '@/db/repositories/receivables';
import { sendMailViaOutlookWithLink, systemSendMailAsResult } from '@/db/repositories/outlook-connections';
import { isValidE164 } from '@/lib/notify/phone';
import { readDoubleTickConfig, isDoubleTickConfigured, sendDoubleTickMessage } from '@/lib/notify/send-whatsapp-doubletick';
import { invoicePartnerIds, partnerOwns } from './co-partners';
import { todayIst } from './dates';
import { leadershipDigestEmail, newInvoiceEmail, revisedInvoiceEmail, rollupEmail, senderPingText } from './email-v2';
import { outlookErrorCode } from './summary-send';
import { digestDue, rollupDue } from './v2-schedule';
import { emails, notifyTeam } from './team-notify';

/** A waiting email goes from the Outlook of whoever approves it. */
const WHOEVER = 'the Outlook of whoever approves';
import type { TemplateSet } from './templates';
import type { WhatsAppPingStatus } from './v2-wire';

/**
 * RECEIVABLES v2 — sending the five emails and the WhatsApp ping (docs/specs/receivables/V2.md).
 *
 * Every email is first written to `receivable_email_log` as `sending` (with a once-per-period key
 * for the automatic ones), then sent through Outlook, then finished as `sent` or `failed` with a
 * reason code. Only after Outlook accepted it is the WhatsApp ping to the sender queued; the ping
 * never throws and never slows or blocks the email (CLAUDE.md rule 6).
 *
 * Senders: A and A′ from the approver's Outlook; B and C from the sheet manager's Outlook; D and a
 * Retry from the clicker's Outlook. Without a connected Outlook the email is logged `failed` with
 * `outlook_not_connected`; there is no fallback to another mailbox (the receivables summary never
 * had one, and the old reminder fallback went with the reminders).
 */

export const RECEIVABLES_APPROVED_EVENT = 'receivables/invoices.approved';
export const RECEIVABLES_EMAIL_SENT_EVENT = 'receivables/email.sent';

export type ApprovalEmailsInput = {
  sheetId: string;
  approverId: string;
  newInvoiceIds: string[];
  revised: Array<{ invoiceId: string; oldAmountInr: number; newAmountInr: number; reason: string | null }>;
};

/* ---- one logged email ------------------------------------------------------------------------ */

/**
 * Sends one logged email from the signed-in person's Outlook (`ctx`) or, in a job, from the named
 * user's stored connection, and records the outcome. Never throws.
 */
export async function deliverLoggedEmail(logId: string, via: { ctx: AuthContext } | { userId: string | null }): Promise<'sent' | 'failed'> {
  try {
    const log = await systemGetEmailLog(logId);
    if (!log) return 'failed';
    const mail = { to: log.to, cc: log.cc, subject: log.subject, html: log.html, text: log.text };
    let code: string | null = null;
    let webLink: string | null = null;
    if ('ctx' in via) {
      try {
        webLink = (await sendMailViaOutlookWithLink(via.ctx, mail)).webLink;
      } catch (e) {
        code = outlookErrorCode(e) ?? 'send_failed';
      }
    } else if (!via.userId) {
      code = 'no_sender';
    } else {
      const res = await systemSendMailAsResult(via.userId, mail, { withLink: true });
      if (res.ok === false) code = res.code;
      else webLink = res.webLink;
    }
    await systemFinishEmailLog(logId, code ? { status: 'failed', error: code } : { status: 'sent', webLink });
    if (code) return 'failed';
    await queueSenderPing(logId);
    return 'sent';
  } catch (e) {
    console.error('[receivables] email send failed', e instanceof Error ? e.message.slice(0, 200) : e);
    await systemFinishEmailLog(logId, { status: 'failed', error: 'send_failed' }).catch(() => undefined);
    return 'failed';
  }
}

/* ---- the WhatsApp ping ------------------------------------------------------------------------- */

/**
 * Queues the WhatsApp ping for an email that went out. Through Inngest when it answers; without an
 * Inngest event key (App Runner today) the ping runs after the response instead. Never throws.
 */
export async function queueSenderPing(logId: string): Promise<void> {
  try {
    const { inngest } = await import('@/jobs/client');
    await inngest.send({ name: RECEIVABLES_EMAIL_SENT_EVENT, id: `rcv-ping:${logId}:${Date.now()}`, data: { logId } });
  } catch {
    try {
      after(() => pingSender(logId).then(() => undefined));
    } catch {
      // Outside a request (a job whose event could not be queued): ping now, the email has gone.
      await pingSender(logId);
    }
  }
}

/**
 * Sends the ping to the sender's own WhatsApp number through DoubleTick and records the outcome on
 * the email log row: `sent`, `failed`, `no_phone` (no valid number in the profile) or `disabled`
 * (DoubleTick not configured). The sender is staff and this is their own tool's notice, so a valid
 * number is enough; the client-facing WhatsApp consent does not apply. Never throws.
 */
export async function pingSender(logId: string): Promise<WhatsAppPingStatus> {
  let status: WhatsAppPingStatus = 'failed';
  try {
    const log = await systemGetEmailLog(logId);
    if (!log || log.status !== 'sent') return 'failed';
    const config = readDoubleTickConfig();
    if (!isDoubleTickConfigured(config)) status = 'disabled';
    else if (!log.senderPhone || !isValidE164(log.senderPhone.trim())) status = 'no_phone';
    else {
      const email = log.to[0] ?? '';
      // The approved template's order: subject, name, address, link (docs/specs/receivables/V2.md).
      // Emails, not names (owner, 20 Nov 2026): To lists every address the email went to.
      const vars = { subject: log.subject, name: [...log.to, ...log.cc].join(', ') || email, email, link: log.webLink || 'Sent Items' };
      const res = await sendDoubleTickMessage({
        to: log.senderPhone,
        templateName: config.receivablesTemplate || null,
        variables: [vars.subject, vars.name, vars.email, vars.link],
        text: senderPingText(vars),
        config,
      });
      status = res.ok ? 'sent' : 'failed';
      if (res.ok === false) console.warn('[receivables] WhatsApp ping not sent', res.error);
    }
    await systemSetEmailWhatsApp(logId, status);
  } catch (e) {
    console.error('[receivables] WhatsApp ping failed', e instanceof Error ? e.message.slice(0, 200) : e);
    await systemSetEmailWhatsApp(logId, 'failed').catch(() => undefined);
  }
  return status;
}

/* ---- A and A′: after an approval ----------------------------------------------------------- */

/**
 * Queues the new and revised invoice emails of one approval through the Inngest event
 * `receivables/invoices.approved`, so approval answers at once. Without an Inngest event key they
 * run after the response instead (`after`, as the summary send does). Never throws.
 */
export async function queueApprovalEmails(input: ApprovalEmailsInput): Promise<void> {
  if (!input.newInvoiceIds.length && !input.revised.length) return;
  try {
    const { inngest } = await import('@/jobs/client');
    await inngest.send({ name: RECEIVABLES_APPROVED_EVENT, data: input });
  } catch {
    try {
      after(() => sendApprovalEmails(input).then(() => undefined));
    } catch (e) {
      console.error('[receivables] approval emails not queued', e instanceof Error ? e.message : e);
    }
  }
}

const partnerOf = (partners: Awaited<ReturnType<typeof systemSheetPartners>>, id: string | null) => (id ? partners.find((p) => p.id === id) : undefined);

/**
 * A: one email per client partner listing that partner's new invoices; A′: one email per revised
 * invoice. Each only when the sheet's switch and the partner's switch are both on. Sent from the
 * approver's Outlook. A key per partner and invoice keeps a retried job from sending twice.
 * Since 20 Nov 2026 each is saved as `awaiting` and goes only when someone approves it in the
 * Email log; `sent` in the counts means prepared.
 */
export async function sendApprovalEmails(input: ApprovalEmailsInput): Promise<{ sent: number; failed: number; skipped: number }> {
  const out = { sent: 0, failed: 0, skipped: 0 };
  const waiting: string[] = [];
  const sheet = await systemSheetEmailSettings(input.sheetId);
  if (!sheet) return out;
  const [partners, links] = await Promise.all([systemSheetPartners(sheet.id), systemCoPartnerLinks(sheet.id)]);
  const senderName = await systemStaffName(input.approverId);
  const today = todayIst();
  const tpls = await templatesOf(sheet.id);

  if (sheet.emailNewInvoiceEnabled && input.newInvoiceIds.length) {
    const invoices = await systemInvoicesById(sheet.id, input.newInvoiceIds);
    const byPartner = new Map<string, EmailInvoiceRow[]>();
    // The lead and every second partner of the client each get the invoice.
    for (const inv of invoices) for (const pid of invoicePartnerIds(inv, links)) byPartner.set(pid, [...(byPartner.get(pid) ?? []), inv]);
    for (const [partnerId, list] of byPartner) {
      const p = partnerOf(partners, partnerId);
      if (!p || !p.active || !p.notifyNewInvoice || !p.email) {
        out.skipped += 1;
        continue;
      }
      const mail = newInvoiceEmail({ partnerName: p.name, senderName, invoices: list, today, tpl: tpls.new_invoice });
      const ids = list.map((i) => i.id).sort();
      const log = await systemStartEmailLog({
        sheetId: sheet.id,
        kind: 'new_invoice',
        partnerId: p.id,
        dedupeKey: `new_invoice:${p.id}:${ids[0]}`,
        recipientName: p.name,
        to: [p.email],
        ...mail,
        senderUserId: input.approverId,
        invoiceIds: ids,
        about: list.length === 1 ? `${list[0]!.invoiceNo ?? 'the invoice'} / ${list[0]!.clientName}` : `${list.length} new invoices`,
        status: 'awaiting',
      });
      if (log) {
        out.sent += 1;
        waiting.push(p.email);
      }
    }
  }

  if (sheet.emailRevisedEnabled && input.revised.length) {
    const invoices = await systemInvoicesById(
      sheet.id,
      input.revised.map((r) => r.invoiceId),
    );
    for (const r of input.revised) {
      const inv = invoices.find((i) => i.id === r.invoiceId);
      const owners = inv ? invoicePartnerIds(inv, links) : [];
      if (!inv || !owners.length) {
        out.skipped += 1;
        continue;
      }
      for (const pid of owners) {
        const p = partnerOf(partners, pid);
        if (!p || !p.active || !p.notifyNewInvoice || !p.email) {
          out.skipped += 1;
          continue;
        }
        const mail = revisedInvoiceEmail({ partnerName: p.name, senderName, invoice: { ...inv, amountInr: r.newAmountInr, oldAmountInr: r.oldAmountInr, reason: r.reason }, today, tpl: tpls.revised });
        const log = await systemStartEmailLog({
          sheetId: sheet.id,
          kind: 'revised',
          partnerId: p.id,
          // The lead keeps the key it had before second partners existed.
          dedupeKey: p.id === inv.partnerId ? `revised:${inv.id}:r${inv.revision}` : `revised:${inv.id}:r${inv.revision}:${p.id}`,
          recipientName: p.name,
          to: [p.email],
          ...mail,
          senderUserId: input.approverId,
          invoiceIds: [inv.id],
          about: `${inv.invoiceNo ?? 'the invoice'} / ${inv.clientName}`,
          status: 'awaiting',
        });
        if (log) {
        out.sent += 1;
        waiting.push(p.email);
      }
      }
    }
  }
  if (out.sent) await notifyTeam(sheet.id, `${emails(out.sent)} (new or revised invoice) wait for approval`, { from: WHOEVER, to: waiting });
  return out;
}

/* ---- B and C: the scheduled emails ------------------------------------------------------- */

/**
 * B: the roll-up of one sheet, if due now. One email per partner with open invoices. Since 20 Nov
 * 2026 nothing goes without approval: each email is saved as `awaiting` (the counts say how many
 * were prepared) and a newer roll-up replaces an older one still waiting for the same partner.
 */
export async function sendSheetRollups(sheet: SheetEmailSettings, now: Date = new Date()): Promise<{ sent: number; failed: number; skipped: number }> {
  const out = { sent: 0, failed: 0, skipped: 0 };
  const waiting: string[] = [];
  const last = await systemLastRollupDate(sheet.id);
  if (!rollupDue(sheet, last, now)) return out;
  const today = todayIst(now);
  const [partners, open, senderName, links, tpls] = await Promise.all([
    systemSheetPartners(sheet.id),
    systemOpenInvoices(sheet.id),
    systemStaffName(sheet.managerUserId),
    systemCoPartnerLinks(sheet.id),
    templatesOf(sheet.id),
  ]);
  for (const p of partners) {
    if (!p.active || !p.notifyRollup || !p.email) continue;
    // The clients the partner leads and the ones they are a second partner on.
    const list = open.filter((i) => partnerOwns(p.id, i, links));
    if (!list.length) {
      out.skipped += 1;
      continue;
    }
    const mail = rollupEmail({ partnerName: p.name, senderName, invoices: list, today, clientOrgName: sheet.clientOrgName, tpl: tpls.rollup });
    const log = await systemStartEmailLog({
      sheetId: sheet.id,
      kind: 'rollup',
      partnerId: p.id,
      periodKey: today,
      dedupeKey: `rollup:${p.id}:${today}`,
      recipientName: p.name,
      to: [p.email],
      ...mail,
      senderUserId: sheet.managerUserId,
      invoiceIds: list.map((i) => i.id),
      about: `${new Set(list.map((i) => i.clientName)).size} client(s), ${list.length} open invoice(s)`,
      status: 'awaiting',
    });
    if (!log) continue;
    await systemReplaceAwaiting(sheet.id, 'rollup', p.id, log.id);
    out.sent += 1;
    waiting.push(p.email);
  }
  if (out.sent) await notifyTeam(sheet.id, `${emails(out.sent)} (roll-up to the partners) wait for approval`, { from: WHOEVER, to: waiting });
  return out;
}

/** The sheet's saved email words; a read that fails keeps the standard words, so a send never stops on it. */
async function templatesOf(sheetId: string): Promise<TemplateSet> {
  try {
    return (await systemTemplatesFor(sheetId)) ?? {};
  } catch {
    return {};
  }
}

/** C: the leadership digest of one sheet, if due now: one email to every recipient, saved as `awaiting`. */
export async function sendSheetDigest(sheet: SheetEmailSettings, now: Date = new Date()): Promise<'sent' | 'failed' | 'skipped' | 'not_due'> {
  if (!digestDue(sheet, now)) return 'not_due';
  const today = todayIst(now);
  const [all, open, partners, senderName, tpls] = await Promise.all([systemDigestRecipients(sheet.id), systemOpenInvoices(sheet.id), systemSheetPartners(sheet.id), systemStaffName(sheet.managerUserId), templatesOf(sheet.id)]);
  // A client partner never gets the whole sheet, even when also typed in as a digest recipient.
  const partnerEmails = new Set(partners.map((p) => p.email.trim().toLowerCase()));
  const recipients = all.filter((r) => !partnerEmails.has(r.email.trim().toLowerCase()));
  if (!recipients.length) return 'skipped';
  const mail = leadershipDigestEmail({
    senderName,
    invoices: open.map((i) => ({ ...i, partnerName: partnerOf(partners, i.partnerId)?.name ?? null })),
    today,
    clientOrgName: sheet.clientOrgName,
    tpl: tpls.digest,
  });
  const log = await systemStartEmailLog({
    sheetId: sheet.id,
    kind: 'digest',
    periodKey: today,
    dedupeKey: `digest:${sheet.id}:${today}`,
    recipientName: recipients.length === 1 ? recipients[0]!.name : `${recipients.length} leadership recipients`,
    to: recipients.map((r) => r.email),
    ...mail,
    senderUserId: sheet.managerUserId,
    invoiceIds: open.map((i) => i.id),
    about: `the ${sheet.clientOrgName} receivables digest`,
    status: 'awaiting',
  });
  if (!log) return 'skipped';
  await systemReplaceAwaiting(sheet.id, 'digest', null, log.id);
  await notifyTeam(sheet.id, 'The leadership digest waits for approval', { from: WHOEVER, to: recipients.map((r) => r.email) });
  return 'sent';
}

/**
 * Prepares the roll-up and digest that are due for one sheet (owner, 20 Nov 2026): no clock, it
 * runs when someone opens Receivables. Each email waits for approval; the dedupe keys keep it to
 * once per day. Never throws, so opening the page never fails on it.
 */
export async function prepareDueEmails(sheetId: string, now: Date = new Date()): Promise<void> {
  try {
    const sheet = await systemSheetEmailSettings(sheetId);
    if (!sheet) return;
    await sendSheetRollups(sheet, now);
    await sendSheetDigest(sheet, now);
  } catch (e) {
    console.error('[receivables] due emails not prepared', e instanceof Error ? e.message.slice(0, 200) : e);
  }
}
