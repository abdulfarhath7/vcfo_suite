import 'server-only';

import { z } from 'zod';
import {
  addCreditNote,
  addInvoice,
  confirmCredit,
  deleteInvoice,
  getManagerSheet,
  getReminderDesk,
  ignoreCredit,
  listCredits,
  listMySheets,
  raiseDispute,
  reopenInvoice,
  resolveDispute,
  setReminderPause,
  setReminderSkipped,
  setTds,
  updateInvoice,
} from '@/db/repositories/receivables';
import { invoiceLabel, num, scopedInvoice } from '@/db/repositories/receivables/shared';
import { addDaysIso, todayIst } from '@/lib/receivables/dates';
import { INVOICE_CURRENCY_CODES } from '@/lib/receivables/currencies';
import { ActionRefused, MANAGING_ROLES } from '../shared';
import { defineAction, type ActionContext } from '../types';
import { recordReceipt } from './flows';
import { inr, pickSheet, run, said, sheetCard } from './shared';

/**
 * Records on the sheet's draft: what the manager would type. Each of these records money or a fact
 * that already happened and moves no money. The client page shows it only after the next publish.
 * An invoice's partner decides who gets reminders, so a partner stays a choice made on the screen.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const amount = z.number().positive().max(1e12);
const invoiceRef = z.object({ invoiceId: z.string().uuid() });
const fxFields = {
  currency: z.enum(INVOICE_CURRENCY_CODES).optional(),
  fcAmount: amount.optional(),
  fxRate: z.number().positive().max(100_000).optional(),
  invoiceDate: isoDate.optional(),
};

async function labelled(actx: ActionContext, invoiceId: string) {
  const { invoice } = await scopedInvoice(actx.auth, invoiceId);
  return { invoice, label: invoiceLabel(invoice), open: num(invoice.amountInr) ?? 0 };
}

const undoOf = (undo: unknown) => (undo ?? {}) as Record<string, never>;

const add = defineAction({
  name: 'receivables.addInvoice',
  description: 'Propose a new invoice on the receivables sheet. invoiceMonth is the first day of its month. A foreign-currency invoice also needs fcAmount, fxRate and invoiceDate, and its rupee amount follows from them. A person approves it on a card.',
  input: z.object({ sheetId: z.string().uuid().optional(), clientName: z.string().trim().min(1).max(120), invoiceNo: z.string().trim().max(40).optional(), invoiceMonth: isoDate, dueDate: isoDate, amountInr: amount, ...fxFields }),
  tier: 'T2',
  roles: MANAGING_ROLES,
  examples: [{ clientName: 'Duravant', invoiceNo: 'SC/09/03', invoiceMonth: '2026-11-01', dueDate: '2026-12-15', amountInr: 125000 }],
  preview: (actx, input) =>
    said(async () => {
      const sheet = await pickSheet(actx, input.sheetId);
      return sheetCard(actx, { action: 'receivables.addInvoice', tier: 'T2', title: 'New invoice', label: sheet.name, target: { ...input, sheetId: sheet.id }, displayNew: `${input.clientName}${input.invoiceNo ? ` ${input.invoiceNo}` : ''}, ${inr(input.amountInr)}, due ${input.dueDate}. Reminders start once a client partner is set on the sheet.` });
    }),
  execute: (actx, { sheetId, ...input }) =>
    run(async () => {
      const invoice = await addInvoice(actx.auth, (await pickSheet(actx, sheetId)).id, input);
      return { ok: true, summary: `Added ${invoiceLabel(invoice)} to the draft.`, undo: { invoiceId: invoice.id } };
    }),
  undo: (actx, undo) =>
    run(async () => {
      await deleteInvoice(actx.auth, undoOf(undo).invoiceId);
      return { ok: true, summary: 'The invoice is off the draft.' };
    }),
});

const edit = defineAction({
  name: 'receivables.updateInvoice',
  description: 'Propose changes to an invoice on the receivables sheet\'s draft: client name, number, month, due date or amount, and the foreign-currency fields. A person approves it on a card.',
  input: invoiceRef.extend({ clientName: z.string().trim().min(1).max(120).optional(), invoiceNo: z.string().trim().max(40).optional(), invoiceMonth: isoDate.optional(), dueDate: isoDate.optional(), amountInr: amount.optional(), ...fxFields }),
  tier: 'T2',
  roles: MANAGING_ROLES,
  preview: (actx, { invoiceId, ...patch }) =>
    said(async () => {
      const { invoice, label } = await labelled(actx, invoiceId);
      const names = Object.keys(patch) as Array<keyof typeof patch>;
      if (names.length === 0) throw new ActionRefused('There is nothing to change on this invoice.');
      return sheetCard(actx, { action: 'receivables.updateInvoice', tier: 'T2', title: 'Change an invoice', label, target: { invoiceId, ...patch }, displayOld: names.map((name) => `${name}: ${invoice[name] ?? 'none'}`).join(', '), displayNew: names.map((name) => `${name}: ${patch[name]}`).join(', ') });
    }),
  execute: (actx, { invoiceId, ...patch }) =>
    run(async () => {
      const { invoice, label } = await labelled(actx, invoiceId);
      await updateInvoice(actx.auth, invoiceId, patch);
      const before = Object.fromEntries(Object.keys(patch).map((name) => [name, invoice[name as keyof typeof invoice] as string | null]));
      return { ok: true, summary: `${label} is updated on the draft.`, undo: { invoiceId, before } };
    }),
  undo: (actx, undo) =>
    run(async () => {
      const { invoiceId, before } = undoOf(undo);
      const restored = { ...(before as Record<string, string | null>) };
      for (const money of ['amountInr', 'fcAmount', 'fxRate'] as const) if (typeof restored[money] === 'string') (restored as Record<string, unknown>)[money] = Number(restored[money]);
      await updateInvoice(actx.auth, invoiceId, restored);
      return { ok: true, summary: 'The invoice is back as it was.' };
    }),
});

/** The invoice meant: by id, or by the number on it when one open invoice on the person's sheets carries it. */
async function openInvoiceId(actx: ActionContext, input: { invoiceId?: string; invoiceNo?: string }): Promise<string> {
  if (input.invoiceId) return input.invoiceId;
  const wanted = input.invoiceNo?.toLowerCase();
  if (!wanted) throw new ActionRefused('Say which invoice this is for.');
  const sheets = await Promise.all((await listMySheets(actx.auth)).map((sheet) => getManagerSheet(actx.auth, sheet.id)));
  const found = sheets.flatMap((sheet) => sheet.invoices).filter((invoice) => invoice.status === 'open' && invoice.invoiceNo?.toLowerCase() === wanted);
  if (found.length === 1) return found[0]!.id;
  throw new ActionRefused(found.length === 0 ? `No open invoice on your sheets is numbered ${input.invoiceNo}.` : `More than one open invoice is numbered ${input.invoiceNo}. Say the client as well.`);
}

const received = defineAction({
  name: 'receivables.markReceived',
  simple: true,
  description: 'Propose marking an invoice received or paid: record a payment that has already arrived against it, in full or in part, with its paid-on date. invoiceNo is the number on the invoice as the person says it. Leave amount out when the whole open balance arrived; otherwise amount is the rupees credited. part true keeps the invoice open with a lower balance. This only records a receipt and moves no money. A person approves it on a card.',
  input: z.object({ invoiceId: z.string().uuid().optional(), invoiceNo: z.string().trim().min(1).max(40).optional(), paidOn: isoDate, amount: amount.optional(), part: z.boolean().optional(), receivedFc: amount.optional(), tdsInr: z.number().min(0).max(1e12).optional() }),
  tier: 'T2',
  roles: MANAGING_ROLES,
  examples: [{ invoiceNo: 'SC/09/03', paidOn: '2026-11-05' }],
  preview: (actx, { invoiceNo, ...input }) =>
    said(async () => {
      const invoiceId = await openInvoiceId(actx, { ...input, invoiceNo });
      const { invoice, label, open } = await labelled(actx, invoiceId);
      if (invoice.status !== 'open') throw new ActionRefused('This invoice is not open.');
      if (input.amount === undefined && (input.part || invoice.currency !== 'INR')) throw new ActionRefused('Say how many rupees were credited.');
      const amount = input.amount ?? open - (input.tdsInr ?? 0);
      return sheetCard(actx, { action: 'receivables.markReceived', tier: 'T2', title: 'Record a receipt', label, target: { ...input, invoiceId, amount }, displayOld: `Open, ${inr(open)}`, displayNew: `${input.part ? 'Part payment' : 'Received'} ${inr(amount)} on ${input.paidOn}${input.tdsInr ? `, TDS ${inr(input.tdsInr)}` : ''}` });
    }),
  execute: (actx, { invoiceId, invoiceNo: _invoiceNo, amount, ...receipt }) =>
    run(async () => {
      // A card always carries both: its preview found the invoice and worked out the amount.
      if (!invoiceId || amount === undefined) return { ok: false, error: 'This card does not say which invoice or how much.' };
      const { label } = await labelled(actx, invoiceId);
      const invoice = await recordReceipt(actx.auth, invoiceId, { ...receipt, amount });
      // A part payment has no undo on the screen either: it is corrected by editing the amount.
      return invoice.status === 'received' ? { ok: true, summary: `${label} is marked received on the draft.`, undo: { invoiceId } } : { ok: true, summary: `Recorded the part payment on ${label}. ${inr(invoice.amountInr)} stays open.` };
    }),
  undo: (actx, undo) =>
    run(async () => {
      await reopenInvoice(actx.auth, undoOf(undo).invoiceId);
      return { ok: true, summary: 'The invoice is open again.' };
    }),
});

const pause = defineAction({
  name: 'receivables.pauseReminders',
  description: 'Propose pausing the payment reminders on a receivables invoice until a date, or resuming them with until left out. A person approves it on a card.',
  input: invoiceRef.extend({ until: isoDate.optional(), reason: z.string().trim().max(200).optional() }),
  tier: 'T2',
  roles: MANAGING_ROLES,
  preview: (actx, input) =>
    said(async () => {
      const { invoice, label } = await labelled(actx, input.invoiceId);
      return sheetCard(actx, { action: 'receivables.pauseReminders', tier: 'T2', title: input.until ? 'Pause reminders' : 'Resume reminders', label, target: input, displayOld: invoice.remindersPausedUntil ? `Paused until ${invoice.remindersPausedUntil}` : 'Reminders on', displayNew: input.until ? `Paused until ${input.until}${input.reason ? `. ${input.reason}` : ''}` : 'Reminders on' });
    }),
  execute: (actx, input) =>
    run(async () => {
      const { invoice, label } = await labelled(actx, input.invoiceId);
      await setReminderPause(actx.auth, input.invoiceId, { until: input.until ?? null, reason: input.reason ?? null });
      return { ok: true, summary: input.until ? `Reminders on ${label} are paused until ${input.until}.` : `Reminders on ${label} are on again.`, undo: { invoiceId: input.invoiceId, until: invoice.remindersPausedUntil ? String(invoice.remindersPausedUntil) : null, reason: invoice.pauseReason } };
    }),
  undo: (actx, undo) =>
    run(async () => {
      const { invoiceId, until, reason } = undoOf(undo);
      await setReminderPause(actx.auth, invoiceId, { until, reason });
      return { ok: true, summary: 'The reminders are back as they were.' };
    }),
});

const dispute = defineAction({
  name: 'receivables.setDispute',
  description: 'Propose raising a dispute on an open receivables invoice, marking it disputed with the reason, which stops its reminders and leaves it out of the ageing; or disputed false to say the dispute is resolved. A person approves it on a card.',
  input: invoiceRef.extend({ disputed: z.boolean(), reason: z.string().trim().max(300).optional() }),
  tier: 'T2',
  roles: MANAGING_ROLES,
  preview: (actx, input) =>
    said(async () => {
      const { invoice, label } = await labelled(actx, input.invoiceId);
      if (input.disputed && !input.reason) throw new ActionRefused('This needs the reason for the dispute.');
      return sheetCard(actx, { action: 'receivables.setDispute', tier: 'T2', title: input.disputed ? 'Mark disputed' : 'Resolve the dispute', label, target: input, displayOld: invoice.disputedAt && !invoice.disputeResolvedAt ? `Disputed: ${invoice.disputeReason}` : 'Not disputed', displayNew: input.disputed ? `Disputed: ${input.reason}` : 'Dispute resolved' });
    }),
  execute: (actx, input) =>
    run(async () => {
      const { invoice, label } = await labelled(actx, input.invoiceId);
      if (input.disputed) await raiseDispute(actx.auth, input.invoiceId, { reason: input.reason ?? '' });
      else await resolveDispute(actx.auth, input.invoiceId);
      return { ok: true, summary: `${label} is ${input.disputed ? 'marked disputed' : 'no longer disputed'}.`, undo: { invoiceId: input.invoiceId, reason: input.disputed ? null : invoice.disputeReason } };
    }),
  undo: (actx, undo) =>
    run(async () => {
      const { invoiceId, reason } = undoOf(undo);
      if (reason) await raiseDispute(actx.auth, invoiceId, { reason });
      else await resolveDispute(actx.auth, invoiceId);
      return { ok: true, summary: 'The dispute is back as it was.' };
    }),
});

const tds = defineAction({
  name: 'receivables.setTds',
  description: 'Propose recording the TDS a client deducted on a receivables invoice, or the date its Form 16A certificate arrived. A person approves it on a card.',
  input: invoiceRef.extend({ tdsInr: z.number().min(0).max(1e12).optional(), certificateOn: isoDate.optional() }),
  tier: 'T2',
  roles: MANAGING_ROLES,
  preview: (actx, input) =>
    said(async () => {
      const { invoice, label } = await labelled(actx, input.invoiceId);
      if (input.tdsInr === undefined && !input.certificateOn) throw new ActionRefused('This needs a TDS amount or a certificate date.');
      return sheetCard(actx, { action: 'receivables.setTds', tier: 'T2', title: 'Record TDS', label, target: input, displayOld: `TDS ${inr(num(invoice.tdsInr))}${invoice.tdsCertificateOn ? `, certificate ${invoice.tdsCertificateOn}` : ''}`, displayNew: [input.tdsInr !== undefined ? `TDS ${inr(input.tdsInr)}` : '', input.certificateOn ? `certificate received ${input.certificateOn}` : ''].filter(Boolean).join(', ') });
    }),
  execute: (actx, { invoiceId, ...input }) =>
    run(async () => {
      const { invoice, label } = await labelled(actx, invoiceId);
      await setTds(actx.auth, invoiceId, input);
      return { ok: true, summary: `The TDS on ${label} is recorded.`, undo: { invoiceId, tdsInr: num(invoice.tdsInr) ?? 0, certificateOn: invoice.tdsCertificateOn ? String(invoice.tdsCertificateOn) : null } };
    }),
  undo: (actx, undo) =>
    run(async () => {
      const { invoiceId, tdsInr, certificateOn } = undoOf(undo);
      await setTds(actx.auth, invoiceId, { tdsInr, certificateOn });
      return { ok: true, summary: 'The TDS is back as it was.' };
    }),
});

const creditNote = defineAction({
  name: 'receivables.addCreditNote',
  description: 'Propose recording a credit note against an open receivables invoice, which lowers its open balance. It must be less than the balance. There is no undo. A person approves it on a card.',
  input: invoiceRef.extend({ number: z.string().trim().max(40).optional(), issuedOn: isoDate, amountInr: amount, reason: z.string().trim().max(300).optional() }),
  tier: 'T2',
  roles: MANAGING_ROLES,
  preview: (actx, input) =>
    said(async () => {
      const { label, open } = await labelled(actx, input.invoiceId);
      return sheetCard(actx, { action: 'receivables.addCreditNote', tier: 'T2', title: 'Record a credit note', label, target: input, displayOld: `Open ${inr(open)}`, displayNew: `Credit note ${inr(input.amountInr)} on ${input.issuedOn}, leaving ${inr(open - input.amountInr)} open` });
    }),
  execute: (actx, { invoiceId, ...input }) =>
    run(async () => {
      const { label } = await labelled(actx, invoiceId);
      const { invoice } = await addCreditNote(actx.auth, invoiceId, input);
      return { ok: true, summary: `Recorded the credit note on ${label}. ${inr(invoice.amountInr)} stays open.` };
    }),
});

const decideCredit = defineAction({
  name: 'receivables.decideCredit',
  description: 'Propose a decision on a bank credit the matcher was not sure of: confirm marks the chosen open invoices received, and ignore records that it is not a receipt. The credit already reached the bank, so this moves no money. There is no undo. A person approves it on a card.',
  input: z.object({ sheetId: z.string().uuid().optional(), creditId: z.string().uuid(), decision: z.enum(['confirm', 'ignore']), invoiceIds: z.array(z.string().uuid()).max(20).optional() }),
  tier: 'T2',
  roles: MANAGING_ROLES,
  preview: (actx, input) =>
    said(async () => {
      const sheet = await pickSheet(actx, input.sheetId);
      const credit = (await listCredits(actx.auth, sheet.id)).find((c) => c.id === input.creditId);
      if (!credit) throw new ActionRefused('That credit is not on this sheet.');
      if (input.decision === 'ignore') return sheetCard(actx, { action: 'receivables.decideCredit', tier: 'T2', title: 'Ignore a bank credit', label: credit.payer, target: { ...input, sheetId: sheet.id }, displayOld: `${inr(num(credit.inrAmount))} on ${credit.valueDate}`, displayNew: 'Not a receipt' });
      const ids = input.invoiceIds ?? credit.matchInvoiceIds ?? [];
      if (ids.length === 0) throw new ActionRefused('Say which invoices this credit pays.');
      const { invoices } = await getManagerSheet(actx.auth, sheet.id);
      const named = ids.map((id) => invoices.find((i) => i.id === id));
      if (named.some((i) => !i || i.status !== 'open')) throw new ActionRefused('One of those invoices is not open on this sheet.');
      return sheetCard(actx, { action: 'receivables.decideCredit', tier: 'T2', title: 'Confirm a bank credit', label: credit.payer, target: { ...input, sheetId: sheet.id, invoiceIds: ids }, displayOld: `${inr(num(credit.inrAmount))} on ${credit.valueDate}`, displayNew: `Marks received: ${named.map((i) => invoiceLabel(i!)).join(', ')}` });
    }),
  execute: (actx, input) =>
    run(async () => {
      if (input.decision === 'ignore') await ignoreCredit(actx.auth, input.creditId);
      else await confirmCredit(actx.auth, input.creditId, input.invoiceIds ?? []);
      return { ok: true, summary: input.decision === 'ignore' ? 'The credit is recorded as not a receipt.' : 'The credit is confirmed, and its invoices are marked received on the draft.' };
    }),
});

const skipReminder = defineAction({
  name: 'receivables.skipReminder',
  description: 'Propose skipping one of today\'s queued payment reminders on the receivables sheet, or skipped false to put it back. Ids come from receivables.reminderQueue. A person approves it on a card.',
  input: z.object({ sheetId: z.string().uuid().optional(), reminderId: z.string().uuid(), skipped: z.boolean() }),
  tier: 'T2',
  roles: MANAGING_ROLES,
  preview: (actx, input) =>
    said(async () => {
      const sheet = await pickSheet(actx, input.sheetId);
      const today = todayIst(actx.now);
      const { queue } = await getReminderDesk(actx.auth, sheet.id, today, addDaysIso(today, -1));
      const row = queue.find((r) => r.reminder.id === input.reminderId);
      if (!row) throw new ActionRefused('That reminder is not in today\'s queue.');
      return sheetCard(actx, { action: 'receivables.skipReminder', tier: 'T2', title: input.skipped ? 'Skip a reminder' : 'Put a reminder back', label: `${row.clientName}${row.invoiceNo ? ` ${row.invoiceNo}` : ''}`, target: { ...input, sheetId: sheet.id }, displayOld: row.reminder.status, displayNew: input.skipped ? 'Skipped today' : 'Queued for today' });
    }),
  execute: (actx, input) =>
    run(async () => {
      await setReminderSkipped(actx.auth, input.reminderId, input.skipped);
      return { ok: true, summary: input.skipped ? 'That reminder is skipped today.' : 'That reminder is back in the queue.', undo: { reminderId: input.reminderId, skipped: !input.skipped } };
    }),
  undo: (actx, undo) =>
    run(async () => {
      const { reminderId, skipped } = undoOf(undo);
      await setReminderSkipped(actx.auth, reminderId, skipped);
      return { ok: true, summary: 'The reminder is back as it was.' };
    }),
});

export const records = [add, edit, received, pause, dispute, tds, creditNote, decideCredit, skipReminder];

export const removeInvoice = defineAction({
  name: 'receivables.deleteInvoice',
  description: 'Propose deleting an invoice from the receivables sheet\'s draft. Published versions keep their copy, and there is no way back from the chat. A person confirms it on a card.',
  input: invoiceRef,
  tier: 'T3',
  roles: MANAGING_ROLES,
  preview: (actx, input) =>
    said(async () => {
      const { label, open } = await labelled(actx, input.invoiceId);
      return sheetCard(actx, { action: 'receivables.deleteInvoice', tier: 'T3', title: 'Remove an invoice', label, target: input, displayOld: inr(open), displayNew: 'Off the draft', recipients: [] });
    }),
  execute: (actx, input) =>
    run(async () => {
      const { label } = await labelled(actx, input.invoiceId);
      await deleteInvoice(actx.auth, input.invoiceId);
      return { ok: true, summary: `${label} is off the draft.` };
    }),
});
