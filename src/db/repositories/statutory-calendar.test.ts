import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthContext } from '@/auth/guards';
import { STATUTORY_DEADLINES } from '@/data/statutory-calendar-fy2627';

/**
 * The statutory calendar is firm-wide reference data with no client in it: every role reads it.
 * Only the admin replaces a year, and every other role is refused before any query runs.
 */

type Call = { op: string; values?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    orderBy: () => c,
    limit: () => c,
    where: () => c,
    values: (v: unknown) => {
      call.values = v;
      return c;
    },
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(results.shift() ?? []).then(res, rej),
  };
  return c;
}
function op(name: string) {
  return () => {
    const call: Call = { op: name };
    calls.push(call);
    return chain(call);
  };
}

const client = { select: op('select'), insert: op('insert'), delete: op('delete') };

vi.mock('@/db/client', () => ({
  db: { ...client, transaction: (fn: (tx: typeof client) => Promise<unknown>) => fn(client) },
}));

const repo = await import('@/db/repositories/statutory-calendar');

function ctx(role: AuthContext['role']): AuthContext {
  return { userId: `user-${role}`, email: `${role}@vcfo.local`, name: `Name ${role}`, role };
}

const deadline = { date: '2027-04-11', act: 'GST' as const, title: 'GSTR-1' };

beforeEach(() => {
  calls.length = 0;
  results = [];
});

describe('getStatutoryCalendar', () => {
  it('serves the built-in FY 2026-27 calendar until that year is imported', async () => {
    results = [[]];
    const view = await repo.getStatutoryCalendar(ctx('intern'), '2026-27');
    expect(view.source).toBe('built-in');
    expect(view.deadlines).toBe(STATUTORY_DEADLINES);
  });

  it('reports a year with no calendar as empty', async () => {
    results = [[]];
    const view = await repo.getStatutoryCalendar(ctx('client'), '2027-28');
    expect(view).toMatchObject({ source: 'none', deadlines: [], fy: { label: 'FY 2027-28' } });
  });

  it('maps an imported year, keeping the RERA authority, the scope and the note', async () => {
    results = [
      [{ fy: '2027-28', fileName: 'cal.xlsx', rowCount: 2, importedBy: 'u', importedByName: 'Asha', importedAt: new Date('2027-03-20T05:00:00Z') }],
      [
        { id: 'a', fy: '2027-28', position: 0, dueDate: '2027-04-07', act: 'RERA', actLabel: 'APRERA', title: 'QPR Q4', appliesTo: null, note: null },
        { id: 'b', fy: '2027-28', position: 1, dueDate: '2027-05-30', act: 'MCA', actLabel: null, title: 'LLP Form 11', appliesTo: 'llp', note: 'If pending' },
      ],
    ];
    const view = await repo.getStatutoryCalendar(ctx('manager'), '2027-28');
    expect(view.source).toBe('imported');
    expect(view.imported).toMatchObject({ fileName: 'cal.xlsx', importedByName: 'Asha', rowCount: 2 });
    expect(view.deadlines).toEqual([
      { id: 'sd-2027-04-07-0', date: '2027-04-07', act: 'RERA', actLabel: 'APRERA', title: 'QPR Q4' },
      { id: 'sd-2027-05-30-1', date: '2027-05-30', act: 'MCA', title: 'LLP Form 11', scope: 'llp', note: 'If pending' },
    ]);
  });
});

describe('replaceStatutoryCalendar', () => {
  it.each(['super_admin', 'manager', 'intern', 'client'] as const)('refuses %s before any query', async (role) => {
    await expect(repo.replaceStatutoryCalendar(ctx(role), '2027-28', [deadline], { fileName: null })).rejects.toThrow('not permitted');
    expect(calls).toEqual([]);
  });

  it('refuses a deadline outside the financial year', async () => {
    await expect(
      repo.replaceStatutoryCalendar(ctx('admin'), '2027-28', [{ ...deadline, date: '2027-03-31' }], { fileName: null }),
    ).rejects.toThrow('invalid_body');
    expect(calls).toEqual([]);
  });

  it('replaces the year as the admin and records who imported it', async () => {
    results = [[{ rowCount: 241 }], [], [], []];
    const out = await repo.replaceStatutoryCalendar(ctx('admin'), '2027-28', [deadline], { fileName: 'cal.xlsx' });
    expect(out).toMatchObject({ rowCount: 1, replacedRowCount: 241, fy: { key: '2027-28' } });
    expect(calls.map((c) => c.op)).toEqual(['select', 'delete', 'insert', 'insert']);
    expect(calls[2].values).toMatchObject({ fy: '2027-28', rowCount: 1, importedBy: 'user-admin', importedByName: 'Name admin' });
    expect(calls[3].values).toEqual([
      { fy: '2027-28', position: 0, dueDate: '2027-04-11', act: 'GST', actLabel: null, title: 'GSTR-1', appliesTo: null, note: null },
    ]);
  });
});

describe('listStatutoryCalendarYears', () => {
  it('adds the built-in year when it was not imported, newest first', async () => {
    results = [[{ fy: '2027-28', rowCount: 230 }]];
    expect(await repo.listStatutoryCalendarYears(ctx('intern'))).toEqual([
      { fy: '2027-28', source: 'imported', rowCount: 230 },
      { fy: '2026-27', source: 'built-in', rowCount: STATUTORY_DEADLINES.length },
    ]);
  });
});
