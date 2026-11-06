import 'server-only';

import { z } from 'zod';
import { editReminder, getManagerSheet, publishSheet } from '@/db/repositories/receivables';
import { invoiceLabel, scopedInvoice } from '@/db/repositories/receivables/shared';
import type { ChangesetRecipient } from '@/lib/ask/changeset/types';
import { cleanRecipients, type RecipientSet } from '@/lib/receivables/recipients';
import { outlookErrorCode } from '@/lib/receivables/summary-send';
import { ActionRefused, MANAGING_ROLES } from '../shared';
import { defineAction } from '../types';
import { reminderDesk, replyToPartner, sendRemindersNow } from './flows';
import { pickSheet, run, said, sheetCard } from './shared';
import { queueSummary, summaryDraft } from './summary';

/**
 * What others on the client's side see. Code works out every recipient from the sheet, and a person
 * confirms each card with those names. The wording of the summary is the finance team's format, so
 * the model writes none of it.
 */

const sheetId = z.string().uuid().optional();
/** Filled by the card, never by the model: who was named on it, because that can change in the days a card waits. */
const cardCheck = z.string().optional();
const cardCheckOf = (keys: readonly string[]) => keys.map((key) => key.toLowerCase()).sort().join(',');
const changed = (what: string) => ({ ok: false as const, error: `${what} since this card was made. Please ask again.` });

const activePartners = (partners: ReadonlyArray<{ name: string; email: string; active: boolean }>) =>
  partners.filter((p) => p.active).map((p) => ({ name: p.name, email: p.email, role: 'Client partner' }));
const peopleOnPublish = (partners: Parameters<typeof activePartners>[0]) => cardCheckOf(activePartners(partners).map((p) => p.email));
const dueReminders = <Row extends { status: string; invoiceOpen: boolean }>(queue: readonly Row[]) => queue.filter((r) => r.status === 'queued' && r.invoiceOpen);

const publish = defineAction({
  name: 'receivables.publish',
  description: 'Propose the Update: the draft becomes what the client page shows, and each partner who asked for alerts hears about their changed invoices. Leave cardCheck out; the card fills it. A person confirms it on a card that lists the partners.',
  input: z.object({ sheetId, note: z.string().trim().max(500).optional(), cardCheck }),
  tier: 'T3',
  roles: MANAGING_ROLES,
  preview: (actx, input) =>
    said(async () => {
      const sheet = await pickSheet(actx, input.sheetId);
      const { partners, unpublishedChanges, latestVersion } = await getManagerSheet(actx.auth, sheet.id);
      return sheetCard(actx, { action: 'receivables.publish', tier: 'T3', title: 'Publish the sheet', label: sheet.name, target: { ...input, sheetId: sheet.id, cardCheck: peopleOnPublish(partners) }, displayOld: latestVersion ? `Version ${latestVersion.seq}` : 'Never published', displayNew: `${unpublishedChanges} change${unpublishedChanges === 1 ? '' : 's'} go on the client page${input.note ? `. ${input.note}` : ''}`, recipients: activePartners(partners) });
    }),
  execute: (actx, input) =>
    run(async () => {
      const sheet = await pickSheet(actx, input.sheetId);
      const { partners } = await getManagerSheet(actx.auth, sheet.id);
      if (peopleOnPublish(partners) !== input.cardCheck) return changed('The partners on this sheet have changed');
      const version = await publishSheet(actx.auth, sheet.id, input.note);
      return { ok: true, summary: `Published version ${version.seq}. The client page now shows it.` };
    }),
});

const sendReminders = defineAction({
  name: 'receivables.sendRemindersNow',
  description: 'Propose sending today\'s queued payment reminders on a sheet now instead of at the send hour. Skipped ones stay skipped. Leave cardCheck out; the card fills it. A person confirms it on a card that lists the partners.',
  input: z.object({ sheetId, cardCheck }),
  tier: 'T3',
  roles: MANAGING_ROLES,
  preview: (actx, input) =>
    said(async () => {
      const sheet = await pickSheet(actx, input.sheetId);
      const due = dueReminders((await reminderDesk(actx.auth, sheet.id)).queue);
      if (due.length === 0) throw new ActionRefused('No reminder is waiting in today\'s queue.');
      const recipients = [...new Map(due.map((r) => [r.partnerEmail, { name: r.partnerName ?? 'Client partner', email: r.partnerEmail ?? undefined, role: 'Client partner' }])).values()];
      return sheetCard(actx, { action: 'receivables.sendRemindersNow', tier: 'T3', title: 'Send today\'s reminders', label: sheet.name, target: { ...input, sheetId: sheet.id, cardCheck: cardCheckOf(due.map((r) => r.id)) }, displayNew: `${due.length} reminder${due.length === 1 ? '' : 's'} go now`, recipients });
    }),
  execute: (actx, input) =>
    run(async () => {
      const sheet = await pickSheet(actx, input.sheetId);
      if (cardCheckOf(dueReminders((await reminderDesk(actx.auth, sheet.id)).queue).map((r) => r.id)) !== input.cardCheck) return changed('Today\'s queue has changed');
      const { pending } = await sendRemindersNow(actx.auth, sheet.id);
      return { ok: true, summary: `${pending} reminder${pending === 1 ? ' is' : 's are'} going out now.` };
    }),
});

const editQueued = defineAction({
  name: 'receivables.editReminder',
  description: 'Propose new wording for one of today\'s queued payment reminders, which then goes out on its own at the send hour. Ids come from receivables.reminderQueue. A person confirms it on a card that names the partner.',
  input: z.object({ sheetId, reminderId: z.string().uuid(), subject: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(5000) }),
  tier: 'T3',
  roles: MANAGING_ROLES,
  preview: (actx, input) =>
    said(async () => {
      const sheet = await pickSheet(actx, input.sheetId);
      const row = (await reminderDesk(actx.auth, sheet.id)).queue.find((r) => r.id === input.reminderId);
      if (!row) throw new ActionRefused('That reminder is not in today\'s queue.');
      return sheetCard(actx, { action: 'receivables.editReminder', tier: 'T3', title: 'Change a reminder', label: `${row.clientName}${row.invoiceNo ? ` ${row.invoiceNo}` : ''}`, target: { ...input, sheetId: sheet.id }, displayOld: row.subject, displayNew: `${input.subject}. ${input.body}`, recipients: [{ name: row.partnerName ?? 'Client partner', email: row.partnerEmail ?? undefined, role: 'Client partner' }] });
    }),
  execute: (actx, input) =>
    run(async () => {
      const row = (await reminderDesk(actx.auth, (await pickSheet(actx, input.sheetId)).id)).queue.find((r) => r.id === input.reminderId);
      if (!row) return { ok: false, error: 'That reminder is not in today\'s queue.' };
      await editReminder(actx.auth, input.reminderId, { subject: input.subject, body: input.body });
      return { ok: true, summary: 'The reminder has the new wording.', undo: { reminderId: input.reminderId, subject: row.subjectOverride, body: row.bodyOverride } };
    }),
  undo: (actx, undo) =>
    run(async () => {
      const { reminderId, subject, body } = (undo ?? {}) as { reminderId: string; subject: string | null; body: string | null };
      await editReminder(actx.auth, reminderId, { subject, body });
      return { ok: true, summary: 'The reminder is back as it was.' };
    }),
});

const reply = defineAction({
  name: 'receivables.replyToPartner',
  description: 'Propose a reply from the firm on an invoice\'s notes. A partner with a login gets a short email with a link to it. Leave cardCheck out; the card fills it. A person confirms it on a card that names the partner.',
  input: z.object({ invoiceId: z.string().uuid(), text: z.string().trim().min(1).max(2000), cardCheck }),
  tier: 'T3',
  roles: MANAGING_ROLES,
  preview: (actx, input) =>
    said(async () => {
      const { invoice, sheet } = await scopedInvoice(actx.auth, input.invoiceId);
      const { partners } = await getManagerSheet(actx.auth, sheet.id);
      const partner = partners.find((p) => p.id === invoice.partnerId);
      const recipients: ChangesetRecipient[] = partner ? [{ name: partner.name, email: partner.email, role: 'Client partner' }] : [];
      return sheetCard(actx, { action: 'receivables.replyToPartner', tier: 'T3', title: 'Reply on an invoice', label: invoiceLabel(invoice), target: { ...input, cardCheck: cardCheckOf(partner ? [partner.id] : []) }, displayNew: input.text, recipients });
    }),
  execute: (actx, input) =>
    run(async () => {
      const { invoice } = await scopedInvoice(actx.auth, input.invoiceId);
      if (cardCheckOf(invoice.partnerId ? [invoice.partnerId] : []) !== input.cardCheck) return changed('This invoice\'s partner has changed');
      const result = await replyToPartner(actx.auth, input.invoiceId, input.text);
      return { ok: true, summary: `The reply is on ${result.invoiceLabel}${result.notify ? `, and ${result.notify.name} gets an email about it` : ''}.` };
    }),
});

/** The ready-made list asked for, valid addresses only and nobody twice. */
function listOf(lists: ReadonlyArray<RecipientSet & { key: string }>, key: string): RecipientSet {
  const list = lists.find((l) => l.key === key);
  if (!list) throw new ActionRefused('There is no previous summary to copy the recipients from.');
  const clean = cleanRecipients(list);
  if (clean.to.length === 0) throw new ActionRefused('Nobody is on that list.');
  return clean;
}

const peopleCheck = ({ to, cc, bcc }: RecipientSet) => cardCheckOf([...to, ...cc, ...bcc].map((r) => r.email));

async function outlookSaid<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    const code = outlookErrorCode(error);
    if (code) throw new ActionRefused(code === 'outlook_not_connected' ? 'Connect your Outlook first, because the summary goes from your own mailbox.' : 'Reconnect your Outlook first, because the summary goes from your own mailbox.');
    throw error;
  }
}

const sendSummary = defineAction({
  name: 'receivables.sendSummary',
  description: 'Propose emailing the published receivables summary from the person\'s own Outlook to a ready-made list: last (same as last time), partners (all client partners) or overdue (partners with overdue invoices). The wording and the Excel file are the standard ones. Leave cardCheck out; the card fills it. A person confirms it on a card that lists everyone.',
  input: z.object({ sheetId, list: z.enum(['last', 'partners', 'overdue']), attachExcel: z.boolean().optional(), cardCheck }),
  tier: 'T3',
  roles: MANAGING_ROLES,
  preview: (actx, input) =>
    said(async () => {
      const sheet = await pickSheet(actx, input.sheetId);
      const draft = await summaryDraft(actx.auth, sheet.id);
      const people = listOf(draft.lists, input.list);
      const recipients = [...people.to.map((r) => ({ ...r, role: 'To' })), ...people.cc.map((r) => ({ ...r, role: 'Cc' })), ...people.bcc.map((r) => ({ ...r, role: 'Bcc' }))];
      return sheetCard(actx, { action: 'receivables.sendSummary', tier: 'T3', title: 'Send the receivables summary', label: sheet.name, target: { ...input, sheetId: sheet.id, cardCheck: peopleCheck(people) }, displayNew: `${draft.subject}, from published version ${draft.versionSeq}${input.attachExcel === false ? '' : ', with the Excel file'}`, recipients });
    }),
  execute: (actx, input) =>
    run(() =>
      outlookSaid(async () => {
        const sheet = await pickSheet(actx, input.sheetId);
        const draft = await summaryDraft(actx.auth, sheet.id);
        const people = listOf(draft.lists, input.list);
        if (peopleCheck(people) !== input.cardCheck) return changed('The people on that list have changed');
        const { from } = await queueSummary(actx.auth, draft.src, { ...people, subject: draft.subject, html: draft.html, attachExcel: input.attachExcel ?? true });
        return { ok: true, summary: `The summary is going out from ${from}. The sheet records whether it arrived.` };
      }),
    ),
});

export const outward = [publish, sendReminders, editQueued, reply, sendSummary];
