import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';
import type { AuditEventRow } from '@/lib/audit/audit-log';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';

vi.mock('server-only', () => ({}));

const listAuditEvents = vi.fn();
const listEngagements = vi.fn();
const loadStaffEngagements = vi.fn();
vi.mock('@/db/repositories/audit-events', () => ({ listAuditEvents: (...a: unknown[]) => listAuditEvents(...a) }));
vi.mock('@/db/repositories/engagements', () => ({ listEngagements: (...a: unknown[]) => listEngagements(...a) }));
vi.mock('@/lib/ask/tools/staff-data', () => ({ loadStaffEngagements: (...a: unknown[]) => loadStaffEngagements(...a) }));

const { approvalsExportRows, auditLogExportRows, clientColumnOf, keepScopedRows, scopedClientNameSet } = await import('./list-sources');

const ctx = (role: AuthContext['role'], userId = 'me'): AuthContext => ({ role, userId }) as AuthContext;

/** `n` events, newest first, one second apart; even ones are document events. */
function events(n: number): AuditEventRow[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    created_at: new Date(Date.UTC(2026, 10, 11, 6, 0, 0) - i * 1000).toISOString(),
    actor_user_id: 'u1',
    actor_role: 'intern',
    actor_email: 'lead@x.test',
    actor_name: 'Leo Lead',
    engagement_id: 'db-1',
    action: i % 2 === 0 ? 'documents.download' : 'checklist.update',
    summary: `Event ${i}`,
    metadata: null,
  })) as AuditEventRow[];
}

beforeEach(() => {
  vi.clearAllMocks();
  listEngagements.mockResolvedValue([{ id: 'db-1', companyName: 'Ember Technologies Private Limited' }]);
});

describe('GL-06 audit log export', () => {
  it('reads every page through the scoped repository, not only the pages on screen, and keeps the filters', async () => {
    const all = events(1200);
    listAuditEvents.mockImplementation(async (_ctx: AuthContext, opts: { before?: Date; beforeId?: string; limit: number }) => {
      const start = opts.beforeId ? all.findIndex((e) => e.id === opts.beforeId) + 1 : 0;
      return all.slice(start, start + opts.limit);
    });
    const rows = await auditLogExportRows(ctx('manager'), { engagementId: null, filters: { search: '', role: 'all', category: 'documents' } });
    // 1200 events over three pages; the Documents filter keeps the even half.
    expect(listAuditEvents).toHaveBeenCalledTimes(3);
    expect(listAuditEvents.mock.calls.every(([c]) => (c as AuthContext).role === 'manager')).toBe(true);
    expect(rows).toHaveLength(600);
    // Date and time in Indian Standard Time; the project name from the scoped engagements.
    expect(rows[0]![0]).toBe('11 Nov 2026');
    expect(rows[0]![1]).toBe('11:30');
    expect(rows[0]![9]).toBe('Ember Technologies Private Limited');
  });

  it('stops at the row cap', async () => {
    listAuditEvents.mockResolvedValue(events(501));
    const rows = await auditLogExportRows(ctx('admin'), { filters: { search: '', role: 'all', category: 'all' } }, 10);
    expect(rows).toHaveLength(10);
  });
});

describe('GL-06 approvals export', () => {
  const pending: ChecklistItemStateSlice = { status: 'in-progress', reviewStatus: 'reviewing', reviewSource: 'lead_manager_request' };
  const staffEng = (id: string, companyName: string, managerId: string) => ({
    dbId: id,
    engagement: { id, companyName, slug: id, stage: 'Pre-Incorporation', managerId },
    state: { 'post-1': pending },
  });

  it('reads the scoped engagements and keeps a manager to their own projects in the manager view', async () => {
    loadStaffEngagements.mockResolvedValue([staffEng('a', 'Alpha Pvt Ltd', 'me'), staffEng('b', 'Beta Pvt Ltd', 'someone-else')]);
    const mine = await approvalsExportRows(ctx('manager'), { scope: 'manager', kind: 'all' });
    expect(mine.map((r) => r[1])).toEqual(['Alpha Pvt Ltd']);
    expect(mine[0]![2]).toBe('Lead request');
    const firm = await approvalsExportRows(ctx('admin'), { scope: 'firm', kind: 'all' });
    expect(firm.map((r) => r[1])).toEqual(['Alpha Pvt Ltd', 'Beta Pvt Ltd']);
    expect(await approvalsExportRows(ctx('admin'), { scope: 'firm', kind: 'send' })).toEqual([]);
  });
});

describe('GL-06 browser-built rows are scoped by client', () => {
  it('drops a row about a client the caller cannot see, keeps firm-wide rows', async () => {
    const allowed = await scopedClientNameSet(ctx('intern'));
    const columns = ['Client', 'Stage'];
    const rows = [
      ['Ember  Technologies Private Limited', 'Pre'],
      ['Someone Else Pvt Ltd', 'Pre'],
      [null, 'Firm'],
    ];
    expect(keepScopedRows(rows, clientColumnOf(columns), allowed)).toEqual([rows[0], rows[2]]);
    expect(keepScopedRows(rows, clientColumnOf(['Step', 'Due']), allowed)).toEqual(rows);
  });
});
