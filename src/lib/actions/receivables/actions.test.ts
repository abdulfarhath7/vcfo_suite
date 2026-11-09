import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppRole, AuthContext } from '@/auth/guards';
import type { ActionContext, ActionResult, AnyAction } from '../types';

/**
 * The receivables actions: who sees each and at which tier, that a card only reads, that they run as
 * the signed-in person, and that code names the recipients. A sheet is on no project, so nothing here
 * needs the run's lock: the repository's own scope, checked at the end of this file, is the guard.
 */
vi.mock('@/db/client', () => ({ db: {} }));

const SHEET = 'a0000000-0000-4000-8000-00000000000a';
const OTHER_SHEET = 'b0000000-0000-4000-8000-00000000000b';
const INVOICE = 'c0000000-0000-4000-8000-00000000000c';
const CREDIT = 'd0000000-0000-4000-8000-00000000000d';
const REMINDER = 'e0000000-0000-4000-8000-00000000000e';

const repo = vi.hoisted(() => ({
  listMySheets: vi.fn(),
  getManagerSheet: vi.fn(),
  invoiceHistory: vi.fn(),
  listCreditNotes: vi.fn(),
  listCredits: vi.fn(),
  sheetStatement: vi.fn(),
  getReminderDesk: vi.fn(),
  getSummarySource: vi.fn(),
  recordSummarySend: vi.fn(),
  addInvoice: vi.fn(),
  updateInvoice: vi.fn(),
  deleteInvoice: vi.fn(),
  markReceived: vi.fn(),
  reopenInvoice: vi.fn(),
  createAwaitedFira: vi.fn(),
  setReminderPause: vi.fn(),
  raiseDispute: vi.fn(),
  resolveDispute: vi.fn(),
  setTds: vi.fn(),
  addCreditNote: vi.fn(),
  confirmCredit: vi.fn(),
  ignoreCredit: vi.fn(),
  setReminderSkipped: vi.fn(),
  editReminder: vi.fn(),
  publishSheet: vi.fn(),
  addSbcNote: vi.fn(),
}));
const scopedInvoice = vi.hoisted(() => vi.fn());
vi.mock('@/db/repositories/receivables', async () => {
  const { ReceivablesError } = await vi.importActual<typeof import('@/db/repositories/receivables/shared')>('@/db/repositories/receivables/shared');
  return { ...repo, ReceivablesError };
});
vi.mock('@/db/repositories/receivables/shared', async () => ({ ...(await vi.importActual<typeof import('@/db/repositories/receivables/shared')>('@/db/repositories/receivables/shared')), scopedInvoice }));
const assertOutlookReady = vi.hoisted(() => vi.fn());
vi.mock('@/db/repositories/outlook-connections', () => ({ assertOutlookReady }));
const sendDueReminders = vi.hoisted(() => vi.fn());
vi.mock('@/lib/receivables/send-reminders', () => ({ sendDueReminders }));
const deliverSummary = vi.hoisted(() => vi.fn());
vi.mock('@/lib/receivables/summary-send', async () => ({ ...(await vi.importActual<typeof import('@/lib/receivables/summary-send')>('@/lib/receivables/summary-send')), deliverSummary }));
const sendEmail = vi.hoisted(() => vi.fn());
vi.mock('@/lib/email/send-email', () => ({ sendEmail }));
const afterQueue = vi.hoisted(() => [] as Array<() => Promise<unknown>>);
vi.mock('next/server', async () => ({ ...(await vi.importActual<typeof import('next/server')>('next/server')), after: (fn: () => Promise<unknown>) => afterQueue.push(fn) }));

const { assertEditorRole, mayEditSheet, ReceivablesError } = await import('@/db/repositories/receivables/shared');
const { actions } = await import('./index');

const byName = (name: string) => actions.find((a: AnyAction) => a.name === name)!;
const person = (role: AppRole): AuthContext => ({ userId: 'u1', email: 'u@x.test', name: 'U', role });
const actx = (role: AppRole = 'manager', engagementId: string | null = null): ActionContext => ({ auth: person(role), engagementId, conversationId: null, runId: 'r', now: new Date('2026-11-06T10:00:00Z'), via: 'ask' });

const MANAGING = ['super_admin', 'admin', 'manager'];
const invoiceRow = { id: INVOICE, clientName: 'Duravant', invoiceNo: 'SC/1', invoiceMonth: '2026-10-01', dueDate: '2026-10-15', amountInr: '125000', fcAmount: null, fxRate: null, currency: 'INR', status: 'open', partnerId: 'p1', remindersPausedUntil: null, pauseReason: null, disputedAt: null, disputeResolvedAt: null, disputeReason: null, tdsInr: null, tdsCertificateOn: null };
const sheetInvoice = { ...invoiceRow, amountInr: 125000, paidOn: null, disputed: false, promisedOn: null, noteCount: 0 };
const partner = { id: 'p1', name: 'Priya', email: 'priya@client.test', slug: 'priya', active: true };
const gone = { id: 'p2', name: 'Left Firm', email: 'gone@client.test', slug: 'gone', active: false };
const queued = { reminder: { id: REMINDER, invoiceId: INVOICE, status: 'queued', kind: 'overdue', daysLeft: -3, forDate: '2026-11-06', channel: 'email', error: null, sentAt: null, subjectOverride: null, bodyOverride: null }, clientName: 'Duravant', invoiceNo: 'SC/1', amountInr: '125000', dueDate: '2026-10-15', invoiceStatus: 'open', partnerName: 'Priya', partnerEmail: 'priya@client.test' };

/** Every action with one working input; recipients and the like appear only where code gives them. */
const TABLE: Array<[string, string, object]> = [
  ['receivables.listSheets', 'T0', {}],
  ['receivables.listInvoices', 'T0', {}],
  ['receivables.invoiceDetail', 'T0', { invoiceId: INVOICE }],
  ['receivables.reminderQueue', 'T0', {}],
  ['receivables.listCredits', 'T0', {}],
  ['receivables.statement', 'T0', {}],
  ['receivables.addInvoice', 'T2', { clientName: 'Duravant', invoiceMonth: '2026-11-01', dueDate: '2026-12-15', amountInr: 100 }],
  ['receivables.updateInvoice', 'T2', { invoiceId: INVOICE, dueDate: '2026-12-31' }],
  ['receivables.markReceived', 'T2', { invoiceId: INVOICE, paidOn: '2026-11-05', amount: 100 }],
  ['receivables.pauseReminders', 'T2', { invoiceId: INVOICE, until: '2026-12-01' }],
  ['receivables.setDispute', 'T2', { invoiceId: INVOICE, disputed: true, reason: 'Wrong rate' }],
  ['receivables.setTds', 'T2', { invoiceId: INVOICE, tdsInr: 100 }],
  ['receivables.addCreditNote', 'T2', { invoiceId: INVOICE, issuedOn: '2026-11-05', amountInr: 100 }],
  ['receivables.decideCredit', 'T2', { creditId: CREDIT, decision: 'ignore' }],
  ['receivables.skipReminder', 'T2', { reminderId: REMINDER, skipped: true }],
  ['receivables.deleteInvoice', 'T3', { invoiceId: INVOICE }],
  ['receivables.publish', 'T3', {}],
  ['receivables.sendRemindersNow', 'T3', {}],
  ['receivables.editReminder', 'T3', { reminderId: REMINDER, subject: 'New', body: 'Text' }],
  ['receivables.replyToPartner', 'T3', { invoiceId: INVOICE, text: 'Thanks' }],
  ['receivables.sendSummary', 'T3', { list: 'partners' }],
];
const undoFrom = (outcome: ActionResult) => (outcome.ok ? outcome.undo! : null);
/** The invoice as the database holds it after a write. */
const saved = (patch: object) => scopedInvoice.mockResolvedValue({ invoice: { ...invoiceRow, ...patch }, sheet: { id: SHEET } });
const needsCard = (a: AnyAction) => a.tier === 'T2' || a.tier === 'T3';
const writes = [repo.recordSummarySend, repo.addInvoice, repo.updateInvoice, repo.deleteInvoice, repo.markReceived, repo.reopenInvoice, repo.createAwaitedFira, repo.setReminderPause, repo.raiseDispute, repo.resolveDispute, repo.setTds, repo.addCreditNote, repo.confirmCredit, repo.ignoreCredit, repo.setReminderSkipped, repo.editReminder, repo.publishSheet, repo.addSbcNote, sendEmail, sendDueReminders, deliverSummary];
/** What runs the card through: the same reparse the changeset does on apply. */
const applied = async (name: string, input: object, ctx = actx()) => {
  const action = byName(name);
  const draft = await action.preview(ctx, action.input.parse(input));
  const row = draft!.rows[0]!;
  return action.execute(ctx, action.input.parse({ ...row.target, value: row.newValue }));
};

beforeEach(() => {
  vi.clearAllMocks();
  afterQueue.length = 0;
  repo.listMySheets.mockResolvedValue([{ id: SHEET, name: 'Duravant sheet', clientOrgName: 'Summit', publishedVersionId: 'v1' }]);
  repo.getManagerSheet.mockResolvedValue({ sheet: { id: SHEET, name: 'Duravant sheet', clientOrgName: 'Summit' }, invoices: [sheetInvoice], partners: [partner, gone], unpublishedChanges: 2, latestVersion: { seq: 3, publishedAt: new Date() } });
  repo.invoiceHistory.mockResolvedValue({ items: [] });
  repo.listCreditNotes.mockResolvedValue([]);
  repo.listCredits.mockResolvedValue([{ id: CREDIT, valueDate: '2026-11-01', payer: 'Duravant', currency: 'INR', fcAmount: null, inrAmount: '100', narration: 'NEFT', status: 'to_confirm', matchInvoiceIds: [INVOICE], matchNote: null }]);
  repo.sheetStatement.mockResolvedValue({ clientOrgName: 'Summit', statement: { client: null, from: '2026-04-01', to: '2026-11-06', clients: [], opening: 0, invoiced: 0, received: 0, closing: 0, lines: [] } });
  repo.getReminderDesk.mockResolvedValue({ sheet: { id: SHEET, reminderRules: { enabled: true } }, queue: [queued], history: [] });
  repo.getSummarySource.mockResolvedValue({ sheet: { id: SHEET, clientOrgName: 'Summit', slug: 's' }, version: { id: 'v1', seq: 3, publishedAt: new Date(), snapshot: [] }, partners: [partner, gone], lastSend: null });
  repo.recordSummarySend.mockResolvedValue({ id: 'send1' });
  assertOutlookReady.mockResolvedValue({ msEmail: 'u@x.test' });
  repo.addInvoice.mockResolvedValue({ id: INVOICE, clientName: 'Duravant', invoiceNo: 'SC/1' });
  repo.markReceived.mockResolvedValue({ id: INVOICE, status: 'received', currency: 'INR', amountInr: 125000 });
  repo.addCreditNote.mockResolvedValue({ invoice: { amountInr: 124900 } });
  repo.publishSheet.mockResolvedValue({ seq: 4 });
  repo.addSbcNote.mockResolvedValue({ note: { authorName: 'U', text: 'Thanks' }, notify: { name: 'Priya', email: 'priya@client.test' }, invoiceLabel: 'Duravant SC/1', invoiceId: INVOICE });
  sendEmail.mockResolvedValue({ ok: true });
  sendDueReminders.mockResolvedValue(undefined);
  scopedInvoice.mockResolvedValue({ invoice: invoiceRow, sheet: { id: SHEET } });
  repo.updateInvoice.mockImplementation(async (_ctx: unknown, _id: string, patch: object) => ({ ...sheetInvoice, ...patch }));
});

afterEach(async () => {
  while (afterQueue.length) await afterQueue.shift()!();
});

describe('the receivables actions', () => {
  it('holds exactly the actions in the table, at that tier, for the people who manage a sheet', () => {
    expect(actions.map((a: AnyAction) => a.name).sort()).toEqual(TABLE.map(([name]) => name).sort());
    for (const [name, tier] of TABLE) {
      expect(byName(name).tier, name).toBe(tier);
      expect([...byName(name).roles].sort(), name).toEqual([...MANAGING].sort());
    }
  });

  it('marks every action firm-wide, so a request needs no client first', () => {
    expect(actions.filter((a: AnyAction) => !a.firmWide).map((a: AnyAction) => a.name)).toEqual([]);
  });

  it('offers nothing to a project lead, a client, a developer or a partner, and has no payment action', () => {
    for (const action of actions) {
      for (const role of ['intern', 'client', 'developer', 'partner']) expect(action.roles).not.toContain(role);
      expect(action.name).not.toMatch(/pay|transfer|forward/i);
      expect(action.tier).not.toBe('T4');
    }
  });

  it.each(TABLE)('%s takes no client, partner or address in its input', (name, _tier, input) => {
    const parsed = byName(name).input.parse({ ...input, engagementId: OTHER_SHEET, partnerId: 'p9', cc: ['x@evil.test'], recipients: ['x@evil.test'] });
    const text = JSON.stringify(parsed);
    for (const planted of [OTHER_SHEET, 'p9', 'x@evil.test']) expect(text).not.toContain(planted);
  });

  it.each(TABLE.filter(([, tier]) => tier !== 'T0'))('%s only prepares a card on preview, on no project, and the card reparses', async (name, _tier, input) => {
    const action = byName(name);
    const draft = await action.preview(actx(), action.input.parse(input));
    expect(draft!.engagementId).toBeNull();
    expect(draft!.tier).toBe(action.tier);
    expect(draft!.rows).toHaveLength(1);
    expect(draft!.rows[0]!.action).toBe(name);
    if (action.tier === 'T3') expect(Array.isArray(draft!.recipients)).toBe(true);
    for (const write of writes) expect(write).not.toHaveBeenCalled();
    expect(action.input.safeParse({ ...draft!.rows[0]!.target, value: draft!.rows[0]!.newValue }).success, name).toBe(true);
  });

  it.each(TABLE)('%s runs as the person and works with no client locked', async (name, _tier, input) => {
    repo.markReceived.mockResolvedValue({ id: INVOICE, status: 'received', currency: 'INR', amountInr: 125000 });
    const outcome = needsCard(byName(name)) ? await applied(name, input) : await byName(name).execute(actx(), byName(name).input.parse(input));
    expect(outcome.ok, `${name}: ${JSON.stringify(outcome)}`).toBe(true);
    const calls = [repo.listMySheets, scopedInvoice, repo.invoiceHistory].flatMap((fn) => fn.mock.calls);
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) expect((call[0] as AuthContext).userId).toBe('u1');
  });

  it('asks which sheet when a person has two, and refuses one that is not theirs', async () => {
    repo.listMySheets.mockResolvedValue([{ id: SHEET, name: 'One' }, { id: 'x', name: 'Two' }]);
    expect(await byName('receivables.listInvoices').execute(actx(), {})).toEqual({ ok: false, error: 'Say which sheet: One or Two.' });
    expect(await byName('receivables.listInvoices').execute(actx(), { sheetId: OTHER_SHEET })).toEqual({ ok: false, error: 'That is not on a receivables sheet you manage.' });
    expect(repo.getManagerSheet).not.toHaveBeenCalled();
    await expect(byName('receivables.publish').preview(actx(), { sheetId: OTHER_SHEET })).rejects.toThrow(/not on a receivables sheet/);
  });

  it('refuses an invoice on a sheet that is not theirs, as if it were not there, and writes nothing', async () => {
    scopedInvoice.mockRejectedValue(new ReceivablesError(404, 'not_found'));
    for (const [name, , input] of TABLE.filter(([, , i]) => 'invoiceId' in i && !('text' in i))) {
      const action = byName(name);
      if (action.tier === 'T0') continue;
      expect(await action.execute(actx(), action.input.parse(input)), name).toEqual({ ok: false, error: 'That is not on a receivables sheet you manage.' });
      await expect(action.preview(actx(), action.input.parse(input)), name).rejects.toThrow(/not on a receivables sheet/);
    }
    for (const write of writes) expect(write).not.toHaveBeenCalled();
  });

  it('turns a repository refusal into a sentence, and leaves a fault as a fault', async () => {
    const onCard = { cardCheck: 'priya@client.test' };
    repo.publishSheet.mockRejectedValueOnce(new ReceivablesError(409, 'not_published'));
    expect(await byName('receivables.publish').execute(actx(), onCard)).toEqual({ ok: false, error: 'Publish the sheet first, so the summary has a version to send.' });
    repo.publishSheet.mockRejectedValueOnce(new ReceivablesError(409, 'some_new_code'));
    expect(await byName('receivables.publish').execute(actx(), onCard)).toEqual({ ok: false, error: 'That could not be done on this sheet.' });
    repo.publishSheet.mockRejectedValueOnce(new Error('database down'));
    await expect(byName('receivables.publish').execute(actx(), onCard)).rejects.toThrow('database down');
  });

  it('names the active partners on a publish card, never one who has left', async () => {
    const draft = await byName('receivables.publish').preview(actx(), {});
    expect(draft!.recipients).toEqual([{ name: 'Priya', email: 'priya@client.test', role: 'Client partner' }]);
  });

  it('refuses a publish card once a partner has joined since it was made', async () => {
    const publish = byName('receivables.publish');
    const target = (await publish.preview(actx(), { cardCheck: 'x@evil.test' }))!.rows[0]!.target;
    expect(target).toMatchObject({ cardCheck: 'priya@client.test' });
    repo.getManagerSheet.mockResolvedValueOnce({ partners: [partner, { ...gone, active: true }] });
    expect(await publish.execute(actx(), publish.input.parse(target))).toEqual({ ok: false, error: expect.stringContaining('have changed') });
    expect(repo.publishSheet).not.toHaveBeenCalled();
    expect(await publish.execute(actx(), publish.input.parse(target))).toMatchObject({ ok: true });
  });

  it('adds an invoice with no partner, whatever the model sends, and undoes it', async () => {
    const action = byName('receivables.addInvoice');
    const outcome = await action.execute(actx(), action.input.parse({ clientName: 'Duravant', invoiceMonth: '2026-11-01', dueDate: '2026-12-15', amountInr: 100, partnerId: 'p9' }));
    expect(repo.addInvoice.mock.calls[0]![2]).not.toHaveProperty('partnerId');
    expect(outcome).toMatchObject({ ok: true, undo: { invoiceId: INVOICE } });
    await action.undo!(actx(), { invoiceId: INVOICE });
    expect(repo.deleteInvoice).toHaveBeenCalledWith(person('manager'), INVOICE);
  });

  it('records a receipt, which moves no money, with an undo only when fully received', async () => {
    const action = byName('receivables.markReceived');
    const full = await applied('receivables.markReceived', { invoiceId: INVOICE, paidOn: '2026-11-05', amount: 125000 });
    expect(full).toMatchObject({ ok: true, undo: { invoiceId: INVOICE } });
    expect(repo.markReceived).toHaveBeenCalledWith(person('manager'), INVOICE, { paidOn: '2026-11-05', amount: 125000 });
    await action.undo!(actx(), { invoiceId: INVOICE });
    expect(repo.reopenInvoice).toHaveBeenCalledWith(person('manager'), INVOICE);
    repo.markReceived.mockResolvedValue({ id: INVOICE, status: 'open', currency: 'INR', amountInr: 25000 });
    const part = await applied('receivables.markReceived', { invoiceId: INVOICE, paidOn: '2026-11-05', amount: 100000, part: true });
    expect(part).toEqual({ ok: true, summary: expect.stringContaining('stays open') });
  });

  it('refuses a receipt on an invoice that is not open', async () => {
    scopedInvoice.mockResolvedValue({ invoice: { ...invoiceRow, status: 'received' }, sheet: { id: SHEET } });
    await expect(byName('receivables.markReceived').preview(actx(), { invoiceId: INVOICE, paidOn: '2026-11-05', amount: 100 })).rejects.toThrow(/not open/);
  });

  it('puts an invoice back as it was, with its amount as a number', async () => {
    const action = byName('receivables.updateInvoice');
    const outcome = await action.execute(actx(), { invoiceId: INVOICE, amountInr: 200, dueDate: '2026-12-31' });
    expect(outcome.ok).toBe(true);
    saved({ amountInr: '200.00', dueDate: '2026-12-31' });
    await action.undo!(actx(), undoFrom(outcome));
    expect(repo.updateInvoice.mock.calls[1]![2]).toEqual({ amountInr: 125000, dueDate: '2026-10-15' });
    await expect(action.preview(actx(), { invoiceId: INVOICE })).rejects.toThrow(/nothing to change/);
  });

  it('puts back the booked amount a currency change set by itself', async () => {
    const action = byName('receivables.updateInvoice');
    const fx = { currency: 'USD', fcAmount: 1000, fxRate: 85, invoiceDate: '2026-10-01' };
    repo.updateInvoice.mockResolvedValueOnce({ ...sheetInvoice, ...fx, amountInr: 85000 });
    const outcome = await action.execute(actx(), { invoiceId: INVOICE, ...fx });
    saved({ ...fx, amountInr: '85000.00' });
    expect(await action.undo!(actx(), undoFrom(outcome))).toMatchObject({ ok: true });
    expect(repo.updateInvoice.mock.calls[1]![2]).toEqual({ currency: 'INR', fcAmount: null, fxRate: null, invoiceDate: null, amountInr: 125000 });
  });

  it('leaves an invoice whose balance has moved since the edit, so a payment is not written over', async () => {
    const action = byName('receivables.updateInvoice');
    const outcome = await action.execute(actx(), { invoiceId: INVOICE, amountInr: 200 });
    saved({ amountInr: '150.00' });
    expect(await action.undo!(actx(), undoFrom(outcome))).toEqual({ ok: false, error: expect.stringContaining('changed after it was saved') });
    expect(repo.updateInvoice).toHaveBeenCalledTimes(1);
  });

  it('records nothing when the balance moved after the card worked out the amount', async () => {
    const action = byName('receivables.markReceived');
    const draft = await action.preview(actx(), action.input.parse({ invoiceId: INVOICE, paidOn: '2026-11-05' }));
    const row = draft!.rows[0]!;
    expect(row.target).toMatchObject({ amount: 125000, openAtCard: 125000 });
    saved({ amountInr: '100000' });
    const outcome = await action.execute(actx(), action.input.parse({ ...row.target, value: row.newValue }));
    expect(outcome).toEqual({ ok: false, error: expect.stringContaining('balance has changed') });
    expect(repo.markReceived).not.toHaveBeenCalled();
  });

  it('undoes a pause, a dispute, a TDS entry and a skipped reminder', async () => {
    const pause = byName('receivables.pauseReminders');
    const paused = await pause.execute(actx(), { invoiceId: INVOICE, until: '2026-12-01', reason: 'Promised' });
    expect(await pause.undo!(actx(), undoFrom(paused))).toEqual({ ok: false, error: expect.stringContaining('changed after it was saved') });
    saved({ remindersPausedUntil: '2026-12-01', pauseReason: 'Promised' });
    await pause.undo!(actx(), undoFrom(paused));
    expect(repo.setReminderPause.mock.calls[1]![2]).toEqual({ until: null, reason: null });

    const dispute = byName('receivables.setDispute');
    saved({});
    const raised = await dispute.execute(actx(), { invoiceId: INVOICE, disputed: true, reason: 'Wrong rate' });
    expect(repo.raiseDispute).toHaveBeenCalledWith(person('manager'), INVOICE, { reason: 'Wrong rate' });
    await dispute.undo!(actx(), undoFrom(raised));
    expect(repo.resolveDispute).toHaveBeenCalled();
    await expect(dispute.preview(actx(), { invoiceId: INVOICE, disputed: true })).rejects.toThrow(/reason/);

    const tds = byName('receivables.setTds');
    const set = await tds.execute(actx(), { invoiceId: INVOICE, tdsInr: 100 });
    saved({ tdsInr: '100.00' });
    await tds.undo!(actx(), undoFrom(set));
    expect(repo.setTds.mock.calls[1]![2]).toEqual({ tdsInr: 0, certificateOn: null });
    await expect(tds.preview(actx(), { invoiceId: INVOICE })).rejects.toThrow(/TDS amount or a certificate/);

    const skip = byName('receivables.skipReminder');
    const skipped = await skip.execute(actx(), { reminderId: REMINDER, skipped: true });
    await skip.undo!(actx(), undoFrom(skipped));
    expect(repo.setReminderSkipped).toHaveBeenLastCalledWith(person('manager'), REMINDER, false);
  });

  it('finds an invoice by its number, and takes the open balance when no amount is said', async () => {
    const outcome = await applied('receivables.markReceived', { invoiceNo: 'sc/1', paidOn: '2026-11-05' });
    expect(outcome).toMatchObject({ ok: true, undo: { invoiceId: INVOICE } });
    expect(repo.markReceived).toHaveBeenCalledWith(person('manager'), INVOICE, { paidOn: '2026-11-05', amount: 125000 });
    const withTds = await byName('receivables.markReceived').preview(actx(), { invoiceNo: 'SC/1', paidOn: '2026-11-05', tdsInr: 25000 });
    expect(withTds!.rows[0]!.target).toMatchObject({ invoiceId: INVOICE, amount: 100000, tdsInr: 25000 });
  });

  it('refuses a receipt it cannot place, and an amount it would have to guess', async () => {
    const action = byName('receivables.markReceived');
    const paidOn = '2026-11-05';
    await expect(action.preview(actx(), { paidOn })).rejects.toThrow(/which invoice/);
    await expect(action.preview(actx(), { invoiceNo: 'SC/404', paidOn })).rejects.toThrow(/No open invoice/);
    await expect(action.preview(actx(), { invoiceId: INVOICE, paidOn, part: true })).rejects.toThrow(/how many rupees/);
    scopedInvoice.mockResolvedValueOnce({ invoice: { ...invoiceRow, currency: 'USD' }, sheet: { id: SHEET } });
    await expect(action.preview(actx(), { invoiceId: INVOICE, paidOn })).rejects.toThrow(/how many rupees/);
    expect(await action.execute(actx(), { invoiceNo: 'SC/1', paidOn })).toEqual({ ok: false, error: expect.stringContaining('which invoice') });
    repo.listMySheets.mockResolvedValue([{ id: SHEET, name: 'One' }, { id: OTHER_SHEET, name: 'Two' }]);
    await expect(action.preview(actx(), { invoiceNo: 'SC/1', paidOn })).rejects.toThrow(/More than one/);
    expect(repo.markReceived).not.toHaveBeenCalled();
  });

  it('confirms a bank credit against the suggested invoices, and refuses one not open', async () => {
    const outcome = await applied('receivables.decideCredit', { creditId: CREDIT, decision: 'confirm' });
    expect(outcome.ok).toBe(true);
    expect(repo.confirmCredit).toHaveBeenCalledWith(person('manager'), CREDIT, [INVOICE]);
    repo.getManagerSheet.mockResolvedValue({ invoices: [{ ...sheetInvoice, status: 'received' }] });
    await expect(byName('receivables.decideCredit').preview(actx(), { creditId: CREDIT, decision: 'confirm' })).rejects.toThrow(/not open/);
    await expect(byName('receivables.decideCredit').preview(actx(), { creditId: OTHER_SHEET, decision: 'ignore' })).rejects.toThrow(/not on this sheet/);
  });

  it('keeps the screen rule that nothing queued means nothing to send, and sends after the answer', async () => {
    repo.getReminderDesk.mockResolvedValueOnce({ sheet: { id: SHEET, reminderRules: {} }, queue: [{ ...queued, reminder: { ...queued.reminder, status: 'skipped' } }], history: [] });
    await expect(byName('receivables.sendRemindersNow').preview(actx(), {})).rejects.toThrow(/No reminder is waiting/);
    const outcome = await applied('receivables.sendRemindersNow', {});
    expect(outcome).toEqual({ ok: true, summary: '1 reminder is going out now.' });
    expect(sendDueReminders).not.toHaveBeenCalled();
    await afterQueue.shift()!();
    expect(sendDueReminders).toHaveBeenCalledWith(expect.any(String), { sheetId: SHEET });
  });

  it('sends reminders only for the queue the card showed, so a card from an earlier day cannot send a later one', async () => {
    const send = byName('receivables.sendRemindersNow');
    const target = (await send.preview(actx(), { cardCheck: 'made-up' }))!.rows[0]!.target;
    expect(target).toMatchObject({ cardCheck: REMINDER });
    repo.getReminderDesk.mockResolvedValueOnce({ sheet: { id: SHEET, reminderRules: {} }, queue: [{ ...queued, reminder: { ...queued.reminder, id: OTHER_SHEET } }], history: [] });
    expect(await send.execute(actx(), send.input.parse(target))).toEqual({ ok: false, error: expect.stringContaining('queue has changed') });
    expect(afterQueue).toHaveLength(0);
  });

  it('edits a queued reminder and puts the old wording back', async () => {
    const edit = byName('receivables.editReminder');
    const outcome = await edit.execute(actx(), { reminderId: REMINDER, subject: 'New', body: 'Text' });
    expect(outcome).toMatchObject({ ok: true, undo: { reminderId: REMINDER, subject: null, body: null } });
    await edit.undo!(actx(), undoFrom(outcome));
    expect(repo.editReminder).toHaveBeenLastCalledWith(person('manager'), REMINDER, { subject: null, body: null });
    await expect(edit.preview(actx(), { reminderId: OTHER_SHEET, subject: 'New', body: 'Text' })).rejects.toThrow(/today's queue/);
  });

  it('emails the partner the code finds on a reply, after the answer', async () => {
    const draft = await byName('receivables.replyToPartner').preview(actx(), { invoiceId: INVOICE, text: 'Thanks' });
    expect(draft!.recipients).toEqual([{ name: 'Priya', email: 'priya@client.test', role: 'Client partner' }]);
    const reply = byName('receivables.replyToPartner');
    await reply.execute(actx(), reply.input.parse(draft!.rows[0]!.target));
    expect(sendEmail).not.toHaveBeenCalled();
    await afterQueue.shift()!();
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'priya@client.test' }));

    repo.addSbcNote.mockClear();
    scopedInvoice.mockResolvedValueOnce({ invoice: { ...invoiceRow, partnerId: 'p3' }, sheet: { id: SHEET } });
    expect(await reply.execute(actx(), reply.input.parse(draft!.rows[0]!.target))).toEqual({ ok: false, error: expect.stringContaining('partner has changed') });
    expect(repo.addSbcNote).not.toHaveBeenCalled();
  });

  it('sends a summary only to the people the card showed, and overwrites what the model claims', async () => {
    const summary = byName('receivables.sendSummary');
    const draft = await summary.preview(actx(), { list: 'partners', cardCheck: 'x@evil.test' });
    expect(draft!.recipients).toEqual([{ name: 'Priya', email: 'priya@client.test', role: 'To' }]);
    const target = draft!.rows[0]!.target as { cardCheck: string };
    expect(target.cardCheck).toBe('priya@client.test,version:v1');

    const newcomer = { id: 'p3', name: 'New', email: 'new@client.test', slug: 'new', active: true };
    repo.getSummarySource.mockResolvedValueOnce({ sheet: { id: SHEET, clientOrgName: 'Summit', slug: 's' }, version: { id: 'v1', seq: 3, publishedAt: new Date(), snapshot: [] }, partners: [partner, newcomer], lastSend: null });
    expect(await summary.execute(actx(), summary.input.parse(target))).toEqual({ ok: false, error: expect.stringContaining('have changed') });
    expect(repo.recordSummarySend).not.toHaveBeenCalled();

    const sent = await summary.execute(actx(), summary.input.parse(target));
    expect(sent).toEqual({ ok: true, summary: expect.stringContaining('u@x.test') });
    expect(repo.recordSummarySend).toHaveBeenCalledWith(person('manager'), SHEET, expect.objectContaining({ to: [{ name: 'Priya', email: 'priya@client.test' }], cc: [], bcc: [], channel: 'outlook', status: 'sending' }));
    expect(deliverSummary).not.toHaveBeenCalled();
    await afterQueue.shift()!();
    expect(deliverSummary).toHaveBeenCalledTimes(1);
  });

  it('refuses a summary when a newer version was published after the card showed one', async () => {
    const summary = byName('receivables.sendSummary');
    const target = (await summary.preview(actx(), { list: 'partners' }))!.rows[0]!.target;
    repo.getSummarySource.mockResolvedValueOnce({ sheet: { id: SHEET, clientOrgName: 'Summit', slug: 's' }, version: { id: 'v2', seq: 4, publishedAt: new Date(), snapshot: [] }, partners: [partner, gone], lastSend: null });
    expect(await summary.execute(actx(), summary.input.parse(target))).toEqual({ ok: false, error: expect.stringContaining('published summary') });
    expect(repo.recordSummarySend).not.toHaveBeenCalled();
  });

  it('refuses a summary with nobody to send to, or with Outlook not connected', async () => {
    const summary = byName('receivables.sendSummary');
    await expect(summary.preview(actx(), { list: 'last' })).rejects.toThrow(/no previous summary/);
    await expect(summary.preview(actx(), { list: 'overdue' })).rejects.toThrow(/Nobody is on that list/);
    assertOutlookReady.mockRejectedValue(new Error('outlook_not_connected'));
    expect(await summary.execute(actx(), { list: 'partners', cardCheck: 'priya@client.test,version:v1' })).toEqual({ ok: false, error: 'Connect your Outlook first, because the summary goes from your own mailbox.' });
  });

  it('reads the queue with each reminder\'s wording, and filters the invoices by overdue', async () => {
    const queue = JSON.parse(((await byName('receivables.reminderQueue').execute(actx(), {})) as { summary: string }).summary);
    expect(queue.queue[0]).toMatchObject({ id: REMINDER, partner: 'Priya', status: 'queued', edited: false });
    const list = JSON.parse(((await byName('receivables.listInvoices').execute(actx(), { show: 'overdue' })) as { summary: string }).summary);
    expect(list.invoices.map((i: { id: string; daysOverdue: number }) => [i.id, i.daysOverdue])).toEqual([[INVOICE, expect.any(Number)]]);
    expect(list.invoices[0].daysOverdue).toBeGreaterThan(0);
  });

  it('says so when a statement period does not read', async () => {
    expect(await byName('receivables.statement').execute(actx(), { from: '2026-11-01', to: '2026-01-01' })).toEqual({ ok: false, error: expect.stringContaining('does not read') });
  });

  it('rests on a repository scope that lets in the sheet\'s own manager and the firm-wide admins only', () => {
    const sheet = { managerUserId: 'u1' };
    expect(mayEditSheet(person('manager'), sheet)).toBe(true);
    expect(mayEditSheet({ ...person('manager'), userId: 'someone-else' }, sheet)).toBe(false);
    for (const role of ['admin', 'super_admin'] as const) expect(mayEditSheet({ ...person(role), userId: 'someone-else' }, sheet)).toBe(true);
    for (const role of ['intern', 'client', 'developer'] as const) expect(() => assertEditorRole(person(role))).toThrow(ReceivablesError);
  });
});
