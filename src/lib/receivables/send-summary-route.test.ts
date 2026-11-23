import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * POST /api/receivables/sheets/:id/send-summary: the route checks the input, the addresses, the
 * published version and the Outlook link before it answers, logs the send as `sending` and
 * answers 202. The workbook and the Graph call run after the response (`after` is captured here
 * and run by hand), and the log row ends `sent` or `failed`. Outlook is mocked, so nothing is sent.
 */

const guard = vi.fn();
const getSummarySource = vi.fn();
const recordSummarySend = vi.fn();
const finishSummarySend = vi.fn();
const getSummarySendStatus = vi.fn();
const sendMailViaOutlook = vi.fn();
const assertOutlookReady = vi.fn();
const startEmailLog = vi.fn();
const systemFinishEmailLog = vi.fn();
const afterQueue: Array<() => Promise<unknown>> = [];
vi.mock('next/server', async () => ({ ...(await vi.importActual<typeof import('next/server')>('next/server')), after: (fn: () => Promise<unknown>) => afterQueue.push(fn) }));
vi.mock('@/auth/guards', () => ({ requireAnyRole: () => guard() }));
vi.mock('@/db/repositories/receivables', async () => {
  const shared = await vi.importActual<typeof import('@/db/repositories/receivables/shared')>('@/db/repositories/receivables/shared');
  return {
    ReceivablesError: shared.ReceivablesError,
    getSummarySource: (...a: unknown[]) => getSummarySource(...a),
    recordSummarySend: (...a: unknown[]) => recordSummarySend(...a),
    finishSummarySend: (...a: unknown[]) => finishSummarySend(...a),
    getSummarySendStatus: (...a: unknown[]) => getSummarySendStatus(...a),
    sentReceiptsFor: async () => ({}),
    // The sheet's leaders (People, Leaders): only an email to them may carry the security deposits.
    listDigestRecipients: async () => ['ceo@sbcllp.in', 'cfo@sbcllp.in'].map((email) => ({ id: email, name: '', email, active: true })),
    systemRecordSentReceipts: async () => undefined,
    startEmailLog: (...a: unknown[]) => startEmailLog(...a),
    systemFinishEmailLog: (...a: unknown[]) => systemFinishEmailLog(...a),
  };
});
vi.mock('@/db/repositories/outlook-connections', () => ({
  sendMailViaOutlook: (...a: unknown[]) => sendMailViaOutlook(...a),
  assertOutlookReady: (...a: unknown[]) => assertOutlookReady(...a),
}));

const { POST, GET } = await import('../../../app/api/receivables/sheets/[id]/send-summary/route');

const ctx = { userId: 'u1', email: 'm@sbcllp.in', name: 'Krishna', role: 'manager' };
const call = (body: unknown) => POST(new Request('http://x/api', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }), { params: Promise.resolve({ id: 'sheet-1' }) });
const runAfter = async () => {
  while (afterQueue.length) await afterQueue.shift()!();
};
const SOURCE = {
  sheet: { id: 'sheet-1', clientOrgName: 'Summit Consulting' },
  version: { id: 'v3', seq: 3, publishedAt: new Date(), snapshot: [] },
  partners: [],
  lastSend: null,
};
const SEND_ID = '11111111-1111-1111-1111-111111111111';
/** One whole-sheet email, the smallest batch. */
const one = (e: { to: Array<{ name: string; email: string }>; cc?: Array<{ name: string; email: string }> }) => ({ emails: [{ kind: 'full', to: e.to, cc: e.cc ?? [], subject: 's', html: '<p>x</p>' }] });

beforeEach(() => {
  vi.clearAllMocks();
  afterQueue.length = 0;
  guard.mockResolvedValue({ ok: true, ctx });
  getSummarySource.mockResolvedValue(SOURCE);
  assertOutlookReady.mockResolvedValue({ msEmail: 'krishna@sbcllp.in' });
  recordSummarySend.mockResolvedValue({ id: SEND_ID });
  finishSummarySend.mockResolvedValue(undefined);
  sendMailViaOutlook.mockResolvedValue({ msEmail: 'krishna@sbcllp.in' });
  let n = 0;
  startEmailLog.mockImplementation(async () => ({ id: `log-${++n}` }));
  systemFinishEmailLog.mockResolvedValue(undefined);
});

describe('send-summary route', () => {
  it('answers 202 before the send runs, then sends each email of the batch with no attachment', async () => {
    const res = await call({
      emails: [
        {
          kind: 'full',
          to: [{ name: 'Yash', email: 'yash@summit.in' }],
          cc: [{ name: 'Rakesh', email: 'rakesh@summit.in' }, { name: 'Yash', email: 'YASH@summit.in' }],
          subject: ' RE: Receivables update - 3 November ',
          html: '<p onclick="x()">Hi Team,</p><script>bad()</script>',
        },
        { kind: 'full', to: [{ name: '', email: 'ceo@sbcllp.in' }], cc: [], subject: 'Receivables', html: '<p>All</p>' },
      ],
    });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ ok: true, queued: true, sendId: SEND_ID, from: 'krishna@sbcllp.in', emails: 2, to: 2, cc: 1, bcc: 0 });
    expect(recordSummarySend).toHaveBeenCalledWith(ctx, 'sheet-1', expect.objectContaining({ versionId: 'v3', channel: 'outlook', status: 'sending' }));
    expect(sendMailViaOutlook).not.toHaveBeenCalled();
    expect(afterQueue).toHaveLength(1);

    await runAfter();
    expect(sendMailViaOutlook).toHaveBeenCalledTimes(2);
    const [sentCtx, mail] = sendMailViaOutlook.mock.calls[0];
    expect(sentCtx).toBe(ctx);
    expect(mail).toMatchObject({ to: ['yash@summit.in'], cc: ['rakesh@summit.in'], bcc: [], subject: 'RE: Receivables update - 3 November', html: '<p>Hi Team,</p>' });
    // The firm never sends an Excel file attached to an email.
    expect(mail.attachments).toBeUndefined();
    expect(finishSummarySend).toHaveBeenCalledWith(ctx, 'sheet-1', SEND_ID, { status: 'sent' });
    // Each email is in the Email log with its HTML, and ends sent.
    expect(startEmailLog).toHaveBeenCalledTimes(2);
    expect(startEmailLog).toHaveBeenCalledWith(ctx, expect.objectContaining({ sheetId: 'sheet-1', kind: 'summary', recipientName: 'Yash', to: ['yash@summit.in'], cc: ['rakesh@summit.in'], html: '<p>Hi Team,</p>', status: 'sending' }));
    expect(systemFinishEmailLog).toHaveBeenCalledWith('log-1', { status: 'sent' });
    expect(systemFinishEmailLog).toHaveBeenCalledWith('log-2', { status: 'sent' });
  });

  it('logs a Collections report as such and never writes "already sent" receipts for it', async () => {
    const res = await call({ ...one({ to: [{ name: 'CEO', email: 'ceo@sbcllp.in' }] }), report: 'collections' });
    expect(res.status).toBe(202);
    expect(startEmailLog).toHaveBeenCalledWith(ctx, expect.objectContaining({ kind: 'collections', invoiceIds: [] }));
    await runAfter();
    expect(sendMailViaOutlook).toHaveBeenCalledTimes(1);
    expect(sendMailViaOutlook.mock.calls[0][1].invoiceIds).toBeUndefined();
  });

  it('refuses a batch where a client partner would see another email', async () => {
    getSummarySource.mockResolvedValue({ ...SOURCE, partners: [{ id: '22222222-2222-4222-8222-222222222222', slug: 'p', name: 'Pranay', email: 'pranay@sbcllp.in', active: true }] });
    const res = await call(one({ to: [{ name: '', email: 'ceo@sbcllp.in' }], cc: [{ name: '', email: 'pranay@sbcllp.in' }] }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'partner_elsewhere' });
    expect(afterQueue).toHaveLength(0);
  });

  it('records a failed send with its reason when Graph fails after the response', async () => {
    sendMailViaOutlook.mockRejectedValue(new Error('Graph sendMail 413'));
    const res = await call(one({ to: [{ name: '', email: 'a@b.in' }] }));
    expect(res.status).toBe(202);
    await runAfter();
    expect(finishSummarySend).toHaveBeenCalledWith(ctx, 'sheet-1', SEND_ID, { status: 'failed', error: 'send_failed' });
    expect(systemFinishEmailLog).toHaveBeenCalledWith('log-1', { status: 'failed', error: 'send_failed' });
  });

  it('refuses a bad address before sending', async () => {
    const res = await call(one({ to: [{ name: '', email: 'not-an-email' }] }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'bad_email', invalid: ['not-an-email'] });
    expect(afterQueue).toHaveLength(0);
  });

  it('says at once when Outlook is not connected and logs nothing', async () => {
    assertOutlookReady.mockRejectedValue(new Error('outlook_not_connected'));
    const res = await call(one({ to: [{ name: '', email: 'a@b.in' }] }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'outlook_not_connected' });
    expect(recordSummarySend).not.toHaveBeenCalled();
    expect(afterQueue).toHaveLength(0);
  });

  it('says at once when Outlook must be connected again', async () => {
    assertOutlookReady.mockRejectedValue(new Error('Token refresh failed: invalid_grant'));
    const res = await call(one({ to: [{ name: '', email: 'a@b.in' }] }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'outlook_reconnect' });
    expect(afterQueue).toHaveLength(0);
  });

  it('keeps other roles out', async () => {
    guard.mockResolvedValue({ ok: false, status: 403, error: 'Forbidden' });
    const res = await call(one({ to: [{ name: '', email: 'a@b.in' }] }));
    expect(res.status).toBe(403);
    expect(getSummarySource).not.toHaveBeenCalled();
  });

  it('reports the state of one send for the dialog to poll', async () => {
    getSummarySendStatus.mockResolvedValue({ status: 'failed', error: 'outlook_reconnect' });
    const res = await GET(new Request(`http://x/api?send=${SEND_ID}`), { params: Promise.resolve({ id: 'sheet-1' }) });
    expect(await res.json()).toEqual({ status: 'failed', error: 'outlook_reconnect' });
    expect(getSummarySendStatus).toHaveBeenCalledWith(ctx, 'sheet-1', SEND_ID);
  });
});

/** The security deposits section (owner, 23 Nov 2026): on the receivables update only, on the leaders’ email only. Invented names. */
describe('send-summary route: the security deposits section', () => {
  const ROW = { client: 'Alpha Corp', totalInr: 30000000, remarks: '100% due' };
  const DEPOSITS = { title: 'Security deposits', rows: [ROW] };
  const leaderMail = (html = '<p>Hi Team,</p><p style="x">Regards,<br>K</p>') => ({ emails: [{ kind: 'full', to: [{ name: '', email: 'ceo@sbcllp.in' }], cc: [], subject: 's', html }] });
  const sentHtml = async () => {
    await runAfter();
    return sendMailViaOutlook.mock.calls[0][1].html as string;
  };

  it('draws the section from the checked rows into the leaders’ email, before Regards', async () => {
    const res = await call({ ...leaderMail(), deposits: DEPOSITS });
    expect(res.status).toBe(202);
    const html = await sentHtml();
    expect(html).toContain('>Security deposits</p>');
    expect(html).toContain('>Alpha Corp<');
    expect(html).toContain('>3,00,00,000<');
    expect(html).toContain('>3.00 cr<');
    expect(html.indexOf('Alpha Corp')).toBeLessThan(html.indexOf('Regards,'));
    expect(startEmailLog).toHaveBeenCalledWith(ctx, expect.objectContaining({ html }));
  });

  it('replaces whatever deposits block the body holds with the checked rows, and drops one sent without rows', async () => {
    const forged = '<p>Hi</p><!--deposits--><div data-deposits="" contenteditable="false"><p>Forged Co 999</p></div><!--/deposits--><p>Regards,</p>';
    await call({ ...leaderMail(forged), deposits: DEPOSITS });
    const html = await sentHtml();
    expect(html).not.toContain('Forged Co');
    expect(html).not.toContain('data-deposits');
    expect(html).toContain('Alpha Corp');
    sendMailViaOutlook.mockClear();
    await call(leaderMail(forged));
    const without = await sentHtml();
    expect(without).toBe('<p>Hi</p><p>Regards,</p>');
  });

  it('refuses a leaders’ email that shows the section but has someone who is not a leader', async () => {
    const shown = '<p>Hi</p><!--deposits--><div data-deposits="" contenteditable="false"><p>x</p></div><!--/deposits--><p>Regards,</p>';
    const res = await call({ emails: [{ kind: 'full', to: [{ name: '', email: 'ceo@sbcllp.in' }], cc: [{ name: '', email: 'outsider@example.com' }], subject: 's', html: shown }], deposits: DEPOSITS });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'deposits_leaders_only' });
    expect(recordSummarySend).not.toHaveBeenCalled();
    expect(sendMailViaOutlook).not.toHaveBeenCalled();
  });

  it('sends the section to the leaders only: a partner and anyone else get the update without it', async () => {
    const pranay = { id: '22222222-2222-4222-8222-222222222222', slug: 'p', name: 'Pranay', email: 'pranay@sbcllp.in', active: true };
    getSummarySource.mockResolvedValue({ ...SOURCE, partners: [pranay] });
    const body = '<p>Hi</p><p style="x">Regards,<br>K</p>';
    const res = await call({
      emails: [
        { kind: 'full', to: [{ name: '', email: 'ceo@sbcllp.in' }], cc: [{ name: '', email: 'cfo@sbcllp.in' }], subject: 's', html: body },
        { kind: 'partner', partnerId: pranay.id, to: [{ name: '', email: 'pranay@sbcllp.in' }], cc: [], subject: 's', html: body },
        { kind: 'full', to: [{ name: '', email: 'someone@example.com' }], cc: [], subject: 's', html: body },
      ],
      deposits: DEPOSITS,
    });
    expect(res.status).toBe(202);
    await runAfter();
    const sent = sendMailViaOutlook.mock.calls.map((c) => ({ to: c[1].to as string[], html: c[1].html as string }));
    expect(sent).toHaveLength(3);
    expect(sent.find((m) => m.to[0] === 'ceo@sbcllp.in')!.html).toContain('Alpha Corp');
    expect(sent.find((m) => m.to[0] === 'pranay@sbcllp.in')!.html).toBe(body);
    expect(sent.find((m) => m.to[0] === 'someone@example.com')!.html).toBe(body);
  });

  it('refuses deposits on the Collections report', async () => {
    const res = await call({ ...leaderMail(), report: 'collections', deposits: DEPOSITS });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'deposits_summary_only' });
    expect(recordSummarySend).not.toHaveBeenCalled();
  });

  it.each([
    ['a long title', { title: 'x'.repeat(81), rows: [ROW] }, 'deposits_title_too_long'],
    ['too many rows', { title: 'SD', rows: Array.from({ length: 51 }, () => ROW) }, 'deposits_too_many_rows'],
    ['a long cell', { title: 'SD', rows: [{ ...ROW, client: 'x'.repeat(201) }] }, 'deposits_cell_too_long'],
    ['long remarks', { title: 'SD', rows: [{ ...ROW, remarks: 'x'.repeat(301) }] }, 'deposits_cell_too_long'],
    ['a negative amount', { title: 'SD', rows: [{ ...ROW, totalInr: -1 }] }, 'deposits_bad_amount'],
    ['a huge amount', { title: 'SD', rows: [{ ...ROW, totalInr: 1e14 }] }, 'deposits_bad_amount'],
    ['an amount as text', { title: 'SD', rows: [{ ...ROW, totalInr: '30,000' }] }, 'deposits_invalid'],
    ['a missing amount', { title: 'SD', rows: [{ client: 'A', remarks: '' }] }, 'deposits_invalid'],
    ['an unknown key', { title: 'SD', rows: [{ ...ROW, html: '<b>x</b>' }] }, 'deposits_invalid'],
    ['rows that are not a list', { title: 'SD', rows: 'Alpha' }, 'deposits_invalid'],
  ])('refuses %s with a clear code', async (_label, deposits, error) => {
    const res = await call({ ...leaderMail(), deposits });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error });
    expect(recordSummarySend).not.toHaveBeenCalled();
  });

  it('accepts 50 rows, 300-character remarks, an empty amount, and trims the cells', async () => {
    const rows = [{ ...ROW, client: '  Beta Ltd  ', remarks: 'y'.repeat(300), totalInr: null }, ...Array.from({ length: 49 }, () => ROW)];
    const res = await call({ ...leaderMail(), deposits: { title: ' ', rows } });
    expect(res.status).toBe(202);
    const html = await sentHtml();
    expect(html).toContain('>Beta Ltd<');
    expect(html).toContain('>Security deposits</p>');
  });

  it('sends no section when every row is empty', async () => {
    const res = await call({ ...leaderMail(), deposits: { title: 'SD', rows: [{ client: ' ', totalInr: null, remarks: '' }] } });
    expect(res.status).toBe(202);
    expect(await sentHtml()).toBe('<p>Hi Team,</p><p style="x">Regards,<br>K</p>');
  });
});
