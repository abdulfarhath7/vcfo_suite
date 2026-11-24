import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';

/**
 * Approving a PAYMENT row from a Tally sync (docs/specs/receivables/TALLY-LIVE.md): it goes through
 * `markReceived` (less than the balance is a part payment), and a payment for an invoice that is
 * already received is refused without touching it.
 */

type Call = { op: string; values?: unknown; set?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];
function chain(call: Call): unknown {
  const c: Record<string, unknown> = {};
  for (const m of ['from', 'leftJoin', 'innerJoin', 'where', 'orderBy', 'limit', 'returning']) c[m] = () => c;
  c.values = (v: unknown) => ((call.values = v), c);
  c.set = (v: unknown) => ((call.set = v), c);
  c.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(results.shift() ?? []).then(res, rej);
  return c;
}
const op = (name: string) => () => {
  const call: Call = { op: name };
  calls.push(call);
  return chain(call);
};
const db: Record<string, unknown> = { select: op('select'), insert: op('insert'), update: op('update'), delete: op('delete') };
db.transaction = async (fn: (tx: unknown) => unknown) => fn(db);
vi.mock('@/db/client', () => ({ db }));
vi.mock('server-only', () => ({}));
const markReceived = vi.fn();
vi.mock('@/db/repositories/receivables/invoices', () => ({ markReceived: (...a: unknown[]) => markReceived(...a) }));

const { approveImportRows } = await import('@/db/repositories/receivables/imports');

const SHEET = '11111111-1111-1111-1111-111111111101';
const MANAGER = '33333333-3333-3333-3333-333333333303';
const ROW = '88888888-8888-8888-8888-888888888808';
const INV = '99999999-9999-9999-9999-999999999909';
const manager: AuthContext = { userId: MANAGER, email: 'm@vcfo.local', name: 'Krishna', role: 'manager' };
const sheetRow = { id: SHEET, name: 'Summit', managerUserId: MANAGER };
const receiptRow = { id: ROW, batchId: 'b1', sheetId: SHEET, kind: 'receipt', invoiceId: INV, clientId: null, amountInr: '40000.00', receivedOn: '2026-11-20', receiptNo: 'RC/7', status: 'pending', source: 'tally_live' };
const invoice = (status: string) => ({ id: INV, sheetId: SHEET, status, amountInr: '100000.00', invoiceNo: 'SCSPL/26-27/164', clientName: 'Duravant' });

beforeEach(() => {
  calls.length = 0;
  results = [];
  vi.clearAllMocks();
});

describe('approveImportRows: payments from Tally', () => {
  it('applies a part payment through markReceived', async () => {
    // sheet, rows, invoices by key, close batch (still open), invoice, claim, log, close batch: open, skip, approved, batch.
    results = [[sheetRow], [receiptRow], [], [{ id: ROW }], [invoice('open')], [{ id: ROW }], [], [], [], [{ id: ROW }], []];
    markReceived.mockResolvedValue({ id: INV });
    const out = await approveImportRows(manager, SHEET, [ROW]);
    expect(markReceived).toHaveBeenCalledWith(manager, INV, { paidOn: '2026-11-20', amount: 40000, part: true });
    expect(out.approved).toBe(1);
    expect(out.received).toEqual([INV]);
    expect(out.refused).toEqual([]);
  });

  it('refuses a payment for an invoice that is already received', async () => {
    results = [[sheetRow], [receiptRow], [], [{ id: ROW }], [invoice('received')], [{ id: ROW }]];
    const out = await approveImportRows(manager, SHEET, [ROW]);
    expect(markReceived).not.toHaveBeenCalled();
    expect(out.refused).toEqual([{ rowId: ROW, code: 'receipt_received' }]);
    expect(out.approved).toBe(0);
  });

  it('puts the row back when markReceived refuses it', async () => {
    results = [[sheetRow], [receiptRow], [], [{ id: ROW }], [invoice('open')], [{ id: ROW }], [], [{ id: ROW }]];
    markReceived.mockRejectedValue(Object.assign(new (await import('@/db/repositories/receivables/shared')).ReceivablesError(400, 'not_open')));
    const out = await approveImportRows(manager, SHEET, [ROW]);
    expect(out.refused).toEqual([{ rowId: ROW, code: 'receipt_received' }]);
    expect(calls.filter((c) => c.op === 'update').at(-1)!.set).toMatchObject({ status: 'pending' });
  });
});
