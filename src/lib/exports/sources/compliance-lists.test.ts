import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';
import type { FilingRow } from '@/lib/compliance/filings';

vi.mock('server-only', () => ({}));

const getFilings = vi.fn();
const getPortalFilings = vi.fn();
const listTasks = vi.fn();
const listExpiryItems = vi.fn();
const getStatutoryCalendar = vi.fn();
const listRequestLists = vi.fn();
vi.mock('@/db/repositories/filings', () => ({ getFilings: (...a: unknown[]) => getFilings(...a) }));
vi.mock('@/db/repositories/client-compliances', () => ({ getPortalFilings: (...a: unknown[]) => getPortalFilings(...a) }));
vi.mock('@/db/repositories/compliance-tasks', () => ({ listTasks: (...a: unknown[]) => listTasks(...a) }));
vi.mock('@/db/repositories/expiry-items', () => ({ listExpiryItems: (...a: unknown[]) => listExpiryItems(...a) }));
vi.mock('@/db/repositories/statutory-calendar', () => ({ getStatutoryCalendar: (...a: unknown[]) => getStatutoryCalendar(...a) }));
vi.mock('@/db/repositories/request-lists', () => ({ listRequestLists: (...a: unknown[]) => listRequestLists(...a) }));

const { complianceCalendarTable, obligationsTable, requestListsTable } = await import('./compliance-lists');

const ctx = (role: AuthContext['role'], extra: Partial<AuthContext> = {}): AuthContext => ({ role, userId: 'me', email: 'me@x.test', name: 'Me', ...extra });

function row(patch: Partial<FilingRow> & { id: string }): FilingRow {
  return {
    engagementId: 'acme',
    companyName: 'Acme Private Limited',
    compliance: 'GST',
    particular: 'GSTR-3B',
    authority: 'GST',
    frequency: 'monthly',
    dueDate: '2026-11-20',
    filedOn: null,
    periodLabel: 'Oct 2026',
    fyLabel: 'FY 2026-27',
    rawStatus: 'upcoming',
    obligationId: 'gst-3b',
    windowFrom: null,
    windowTo: null,
    ...patch,
  };
}

const now = new Date('2026-11-12T06:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
  getPortalFilings.mockResolvedValue([]);
  listTasks.mockResolvedValue({ tasks: [], today: '2026-11-12' });
  listExpiryItems.mockResolvedValue([]);
  getStatutoryCalendar.mockResolvedValue({ deadlines: [] });
});

describe('GL-06 Obligations export', () => {
  beforeEach(() => {
    getFilings.mockImplementation(async (_ctx: AuthContext, q: { fyStartYear: number }) =>
      q.fyStartYear === 2026
        ? {
            rows: [
              row({ id: 'a' }),
              row({ id: 'b', engagementId: 'birch', companyName: 'Birch LLP' }),
              row({ id: 'c', engagementId: 'birch', companyName: 'Birch LLP', dueDate: '2026-10-20', filedOn: '2026-10-18', periodLabel: 'Sep 2026' }),
            ],
            companies: [],
          }
        : { rows: [], companies: [] },
    );
  });

  it('reads both financial years with the caller’s context and keeps the client and state filters', async () => {
    const f = { source: 'obligations' as const, companyId: 'birch', groupBy: 'filing' as const, state: '' as const, cat: 'stat' as const, workType: 'all' as const };
    const all = await obligationsTable(ctx('intern', { internId: 'lead-1' }), f, now);
    expect(getFilings).toHaveBeenCalledTimes(2);
    expect(getFilings.mock.calls.every(([c]) => (c as AuthContext).internId === 'lead-1')).toBe(true);
    expect(all.columns).toEqual(['Obligation', 'Client', 'Law', 'Lead', 'Last filed', 'Status', 'Next due']);
    expect(new Set(all.rows.map((r) => r[1]))).toEqual(new Set(['Birch LLP']));
    const done = await obligationsTable(ctx('intern', { internId: 'lead-1' }), { ...f, companyId: 'all', state: 'done' }, now);
    expect(done.rows.every((r) => r[5] === 'Filed')).toBe(true);
  });

  it('adds the non-statutory tasks in the All category, and only those in Non-statutory', async () => {
    listTasks.mockResolvedValue({
      tasks: [
        { title: 'Board pack', companyName: 'Acme Private Limited', dueDate: '2026-11-14', word: 'Not started', week: 'This week', stage: 'not-started', boardMeetingId: null, owner: { name: 'Leela' }, hidden: false },
        { title: 'Hidden', companyName: 'Acme Private Limited', dueDate: '2026-11-14', word: 'Not started', week: 'This week', stage: 'not-applicable', boardMeetingId: null, owner: null, hidden: true },
      ],
      today: '2026-11-12',
    });
    const f = { source: 'obligations' as const, companyId: 'all', groupBy: 'filing' as const, state: '' as const, cat: 'ns' as const, workType: 'all' as const };
    const ns = await obligationsTable(ctx('manager'), f, now);
    expect(ns.rows).toEqual([['Board pack', 'Acme Private Limited', 'Non-statutory', 'Leela', null, 'Not started', '2026-11-14']]);
  });
});

describe('GL-06 compliance calendar export', () => {
  it('exports the month in view for the picked company, in due-date order', async () => {
    getFilings.mockResolvedValue({
      rows: [
        row({ id: 'a', dueDate: '2026-11-20' }),
        row({ id: 'b', dueDate: '2026-11-11', particular: 'GSTR-1' }),
        row({ id: 'c', dueDate: '2026-12-20' }),
        row({ id: 'd', engagementId: 'birch', companyName: 'Birch LLP', dueDate: '2026-11-15' }),
      ],
      companies: [],
    });
    const f = { source: 'compliance-calendar' as const, companyId: 'acme', sole: false, monthKey: '2026-11', view: 'month' as const, cat: 'all' as const, areas: [] };
    const table = await complianceCalendarTable(ctx('manager'), f, now);
    expect(table.rows.map((r) => [r[0], r[1], r[2]])).toEqual([
      ['2026-11-11', 'GSTR-1', 'Acme Private Limited'],
      ['2026-11-20', 'GSTR-3B', 'Acme Private Limited'],
    ]);
    expect(getFilings.mock.calls[0]![1]).toEqual({ fyStartYear: 2026 });
    // The year view covers the whole financial year.
    const year = await complianceCalendarTable(ctx('manager'), { ...f, view: 'year' }, now);
    expect(year.rows).toHaveLength(3);
    // The Non-statutory filter leaves out the filings.
    expect((await complianceCalendarTable(ctx('manager'), { ...f, cat: 'non-statutory' }, now)).rows).toEqual([]);
  });
});

describe('GL-06 Request lists export', () => {
  it('exports the tab in view, from the scoped read', async () => {
    const list = (title: string, status: string) => ({ title, companyName: 'Acme Private Limited', dueOn: '2026-11-30', reminderCount: 1, status, progress: { done: 1, total: 3 } });
    listRequestLists.mockResolvedValue([list('Open one', 'sent'), list('Draft one', 'draft'), list('Closed one', 'complete')]);
    const open = await requestListsTable(ctx('manager'), { source: 'request-lists', tab: 'open' });
    expect(open.rows).toEqual([['Open one', 'Acme Private Limited', '2026-11-30', 1, '1 of 3', 'Waiting on client']]);
    const closed = await requestListsTable(ctx('manager'), { source: 'request-lists', tab: 'closed' });
    expect(closed.rows.map((r) => r[0])).toEqual(['Closed one']);
    expect(listRequestLists.mock.calls[0]![0]).toMatchObject({ role: 'manager' });
  });
});
