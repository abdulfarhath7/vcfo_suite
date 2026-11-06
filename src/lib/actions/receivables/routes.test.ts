import { beforeEach, describe, expect, it, vi } from 'vitest';

/** The routes that moved to the shared functions answer as before. Repository and email are mocked. */

const guard = vi.hoisted(() => vi.fn());
const repo = vi.hoisted(() => ({ getReminderDesk: vi.fn(), getSummarySource: vi.fn(), listNotes: vi.fn(), addSbcNote: vi.fn() }));
const sendEmail = vi.hoisted(() => vi.fn());
const afterQueue = vi.hoisted(() => [] as Array<() => Promise<unknown>>);
vi.mock('next/server', async () => ({ ...(await vi.importActual<typeof import('next/server')>('next/server')), after: (fn: () => Promise<unknown>) => afterQueue.push(fn) }));
vi.mock('@/auth/guards', () => ({ requireAnyRole: () => guard() }));
vi.mock('@/lib/email/send-email', () => ({ sendEmail }));
vi.mock('@/db/repositories/receivables', async () => {
  const { ReceivablesError } = await vi.importActual<typeof import('@/db/repositories/receivables/shared')>('@/db/repositories/receivables/shared');
  return { ...repo, ReceivablesError };
});

const { ReceivablesError } = await import('@/db/repositories/receivables/shared');
const reminders = (await import('../../../../app/api/receivables/sheets/[id]/reminders/route')).GET;
const summary = (await import('../../../../app/api/receivables/sheets/[id]/summary/route')).GET;
const notes = await import('../../../../app/api/receivables/invoices/[id]/notes/route');

const params = { params: Promise.resolve({ id: 'x1' }) };
const get = () => new Request('http://x/api');
const post = (body: unknown) => new Request('http://x/api', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
const queued = (subjectOverride: string | null, status = 'queued') => ({
  reminder: { id: 'r1', invoiceId: 'i1', status, kind: 'overdue', daysLeft: -3, forDate: '2026-11-06', channel: 'email', error: null, sentAt: null, subjectOverride, bodyOverride: null },
  clientName: 'Duravant',
  invoiceNo: 'SC/1',
  amountInr: '125000',
  dueDate: '2026-10-15',
  invoiceStatus: 'open',
  partnerName: 'Priya',
  partnerEmail: 'priya@client.test',
});

beforeEach(() => {
  vi.clearAllMocks();
  afterQueue.length = 0;
  guard.mockResolvedValue({ ok: true, ctx: { userId: 'u1', email: 'u@x.test', name: 'U', role: 'manager' } });
  repo.getReminderDesk.mockResolvedValue({ sheet: { id: 's1', reminderRules: { enabled: true } }, queue: [queued('Own subject')], history: [queued(null, 'sent')] });
  repo.getSummarySource.mockResolvedValue({ sheet: { id: 's1', clientOrgName: 'Summit', slug: 's' }, version: { id: 'v1', seq: 3, publishedAt: '2026-11-01T00:00:00.000Z', snapshot: [] }, partners: [], lastSend: null });
  repo.addSbcNote.mockResolvedValue({ note: { authorName: 'U', text: 'Thanks' }, notify: { name: 'Priya', email: 'priya@client.test' }, invoiceLabel: 'Duravant SC/1', invoiceId: 'i1' });
  sendEmail.mockResolvedValue({ ok: true });
});

describe('receivables routes', () => {
  it('refuses a role the guard refuses, before anything else', async () => {
    guard.mockResolvedValue({ ok: false, status: 403, error: 'forbidden' });
    for (const response of [await reminders(get(), params), await summary(get(), params), await notes.POST(post({ text: 'Thanks' }), params)]) expect(response.status).toBe(403);
    expect(repo.getReminderDesk).not.toHaveBeenCalled();
    expect(repo.getSummarySource).not.toHaveBeenCalled();
    expect(repo.addSbcNote).not.toHaveBeenCalled();
  });

  it('answers the reminder desk with each text to send, and leaves the raw overrides out', async () => {
    const body = await (await reminders(get(), params)).json();
    expect(body.rules).toEqual({ enabled: true });
    expect(body.queue[0]).toMatchObject({ id: 'r1', subject: 'Own subject', edited: true, invoiceOpen: true, partnerEmail: 'priya@client.test', amountInr: 125000 });
    expect(body.queue[0]).not.toHaveProperty('subjectOverride');
    expect(body.queue[0]).not.toHaveProperty('bodyOverride');
    expect(body.history[0]).toMatchObject({ status: 'sent', edited: false });
  });

  it('answers the summary draft without the source it was built from', async () => {
    const body = await (await summary(get(), params)).json();
    expect(body).toMatchObject({ versionSeq: 3, lastSentAt: null });
    expect(body.subject).toEqual(expect.any(String));
    expect(body.html).toEqual(expect.any(String));
    expect(body).not.toHaveProperty('src');
  });

  it('keeps the status of a repository refusal', async () => {
    repo.getSummarySource.mockRejectedValue(new ReceivablesError(409, 'not_published'));
    const response = await summary(get(), params);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'not_published' });
  });

  it('saves a reply, answers with the note, and emails the partner only after the answer', async () => {
    const response = await notes.POST(post({ text: '  Thanks  ' }), params);
    expect(await response.json()).toEqual({ note: { authorName: 'U', text: 'Thanks' } });
    expect(repo.addSbcNote).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1' }), 'x1', 'Thanks');
    expect(sendEmail).not.toHaveBeenCalled();
    await afterQueue.shift()!();
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'priya@client.test', purpose: 'receivables.sbc_reply' }));
  });

  it('refuses an empty reply and does not fail on a partner with no login', async () => {
    expect((await notes.POST(post({ text: '  ' }), params)).status).toBe(400);
    expect(repo.addSbcNote).not.toHaveBeenCalled();
    repo.addSbcNote.mockResolvedValue({ note: { authorName: 'U', text: 'Thanks' }, notify: null, invoiceLabel: 'Duravant SC/1', invoiceId: 'i1' });
    expect((await notes.POST(post({ text: 'Thanks' }), params)).status).toBe(200);
    expect(afterQueue).toHaveLength(0);
  });

  it('lists an invoice\'s notes', async () => {
    repo.listNotes.mockResolvedValue([{ authorName: 'U', text: 'Thanks' }]);
    expect(await (await notes.GET(get(), params)).json()).toEqual({ notes: [{ authorName: 'U', text: 'Thanks' }] });
  });
});
