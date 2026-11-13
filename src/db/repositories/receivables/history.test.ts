import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';

/**
 * Phase 10 change trail (history.ts): the sheet's own manager, the firm-wide admins and the staff
 * named as editors of the sheet read the pending changes or an invoice's history. Another manager,
 * or a project lead who is not an editor, reads them as not found after one editor lookup. Clients,
 * developers and partners are refused before any query.
 */

const calls: string[] = [];
let results: unknown[][] = [];
function chain(): unknown {
  const c: Record<string, unknown> = {};
  for (const m of ['from', 'leftJoin', 'innerJoin', 'where', 'orderBy', 'limit']) c[m] = () => c;
  c.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(results.shift() ?? []).then(res, rej);
  return c;
}
const db = {
  select: () => {
    calls.push('select');
    return chain();
  },
};
vi.mock('@/db/client', () => ({ db }));
vi.mock('server-only', () => ({}));

const repo = await import('./history');

const SHEET = '11111111-1111-1111-1111-111111111101';
const INVOICE = '22222222-2222-2222-2222-222222222202';
const MANAGER = '33333333-3333-3333-3333-333333333303';
const ctx = (role: AuthContext['role'], userId = `user-${role}`): AuthContext => ({ userId, email: `${role}@vcfo.local`, name: role, role });
const sheetRow = { id: SHEET, managerUserId: MANAGER, name: 'S', clientOrgName: 'S' };
const invoiceRow = { id: INVOICE, sheetId: SHEET, clientName: 'Duravant', invoiceNo: 'SC/09/03', deletedAt: null };

beforeEach(() => {
  calls.length = 0;
  results = [];
});

describe('roles that never edit a sheet', () => {
  for (const role of ['client', 'developer', 'partner'] as const) {
    it(`refuses ${role} before any query`, async () => {
      await expect(repo.listPendingChanges(ctx(role), SHEET)).rejects.toMatchObject({ status: 404 });
      await expect(repo.invoiceHistory(ctx(role), INVOICE)).rejects.toMatchObject({ status: 404 });
      expect(calls).toHaveLength(0);
    });
  }
});

describe('another manager', () => {
  const other = ctx('manager', '99999999-9999-9999-9999-999999999909');
  it('reads the pending changes as not found', async () => {
    // The sheet read, then the editor lookup, which finds no row.
    results = [[sheetRow], []];
    await expect(repo.listPendingChanges(other, SHEET)).rejects.toMatchObject({ status: 404 });
    expect(calls).toHaveLength(2);
  });
  it('reads an invoice history as not found', async () => {
    results = [[invoiceRow], [sheetRow], []];
    await expect(repo.invoiceHistory(other, INVOICE)).rejects.toMatchObject({ status: 404 });
    expect(calls).toHaveLength(3);
  });
});

describe('a project lead', () => {
  const lead = ctx('intern', '77777777-7777-7777-7777-777777777707');
  it('who is not an editor of the sheet is refused: not found, nothing read past the editor lookup', async () => {
    results = [[sheetRow], []];
    await expect(repo.listPendingChanges(lead, SHEET)).rejects.toMatchObject({ status: 404 });
    expect(calls).toHaveLength(2);
    calls.length = 0;
    results = [[invoiceRow], [sheetRow], []];
    await expect(repo.invoiceHistory(lead, INVOICE)).rejects.toMatchObject({ status: 404 });
    expect(calls).toHaveLength(3);
  });
});

describe('the sheet’s manager', () => {
  const me = ctx('manager', MANAGER);

  it('lists the pending changes newest first, with no publish yet', async () => {
    const at = new Date('2026-11-04T05:00:00Z');
    results = [[sheetRow], [], [{ id: 'c1', invoiceId: INVOICE, summary: 'Duravant SC/09/03 added', field: null, before: null, after: null, affectsPage: true, createdAt: at, actorName: 'Manager' }]];
    const out = await repo.listPendingChanges(me, SHEET);
    expect(out.since).toBeNull();
    expect(out.changes).toEqual([expect.objectContaining({ id: 'c1', summary: 'Duravant SC/09/03 added', createdAt: at.toISOString(), actorName: 'Manager' })]);
  });

  it('merges changes, reminders and notes into one list, newest first', async () => {
    const published = new Date('2026-11-02T00:00:00Z');
    results = [
      [invoiceRow],
      [sheetRow],
      // The last publish is read first (it is awaited inside its own helper).
      [{ publishedAt: published }],
      [
        { id: 'c-old', invoiceId: INVOICE, summary: 'added', field: null, before: null, after: null, affectsPage: true, createdAt: new Date('2026-11-01T00:00:00Z'), actorName: null },
        { id: 'c-new', invoiceId: INVOICE, summary: 'due date edited', field: 'dueDate', before: '2026-10-16', after: '2026-10-20', affectsPage: true, createdAt: new Date('2026-11-03T00:00:00Z'), actorName: 'M' },
      ],
      [{ id: 'r1', forDate: '2026-11-02', kind: 'overdue', status: 'sent', channel: 'outlook', toEmail: 'p@x.in', error: null, sentAt: new Date('2026-11-02T03:30:00Z'), createdAt: new Date('2026-11-02T02:30:00Z') }],
      [{ id: 'n1', text: 'Will pay Friday', authorName: 'Priya', fromSbc: false, createdAt: new Date('2026-11-04T00:00:00Z') }],
    ];
    const { items } = await repo.invoiceHistory(me, INVOICE);
    expect(items.map((i) => i.id)).toEqual(['n1', 'c-new', 'r1', 'c-old']);
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    expect(byId['c-old']).toMatchObject({ kind: 'change', published: true });
    expect(byId['c-new']).toMatchObject({ kind: 'change', published: false, before: '2026-10-16', after: '2026-10-20' });
    expect(byId.r1).toMatchObject({ kind: 'reminder', status: 'sent', channel: 'outlook', reminderKind: 'overdue' });
  });
});
