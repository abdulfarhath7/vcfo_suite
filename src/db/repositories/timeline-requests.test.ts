import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { AuthContext } from '@/auth/guards';

/**
 * Closed timeline requests across the book (Date requests › Decided):
 *   - only managers, admins and super admins read them; leads and clients get
 *     nothing and nothing is queried;
 *   - rows are limited to the caller's engagement scope (cross-tenant guard);
 *   - pending rows are left out (they keep the per-engagement read).
 */

const listScopedEngagementIds = vi.fn();
const wheres: SQL[] = [];
let batches: unknown[][] = [];

function chain(): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    where: (w: SQL) => {
      wheres.push(w);
      return c;
    },
    orderBy: () => c,
    limit: () => c,
    then: (resolve: (v: unknown[]) => unknown) => resolve(batches.shift() ?? []),
  };
  return c;
}

vi.mock('@/db/client', () => ({ db: { select: () => chain() } }));
vi.mock('@/db/repositories/engagements', () => ({
  listScopedEngagementIds: (...a: unknown[]) => listScopedEngagementIds(...a),
}));

const { listClosedTimelineRequests } = await import('@/db/repositories/timeline-requests');
const dialect = new PgDialect();

const OWN = '11111111-1111-1111-1111-111111111101'; // legacy "e1"
const OTHER = '22222222-2222-2222-2222-222222222202';

function ctx(role: AuthContext['role']): AuthContext {
  return { userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role };
}

beforeEach(() => {
  vi.clearAllMocks();
  wheres.length = 0;
  batches = [];
});

describe('listClosedTimelineRequests', () => {
  it.each(['intern', 'client'] as const)('%s reads nothing and queries nothing', async (role) => {
    await expect(listClosedTimelineRequests(ctx(role))).resolves.toEqual([]);
    expect(listScopedEngagementIds).not.toHaveBeenCalled();
    expect(wheres).toHaveLength(0);
  });

  it('a manager with no engagements in scope gets [] without reading the table', async () => {
    listScopedEngagementIds.mockResolvedValue([]);
    await expect(listClosedTimelineRequests(ctx('manager'))).resolves.toEqual([]);
    expect(wheres).toHaveLength(0);
  });

  it('scopes the read to the caller’s engagements and leaves pending rows out', async () => {
    listScopedEngagementIds.mockResolvedValue([OWN]);
    batches = [[]];
    await listClosedTimelineRequests(ctx('manager'));
    const q = dialect.sqlToQuery(wheres[0]!);
    expect(q.sql).toContain('"engagement_id" in');
    expect(q.params).toContain(OWN);
    expect(q.params).not.toContain(OTHER);
    expect(q.sql).toContain('"status" <>');
    expect(q.params).toContain('pending');
  });

  it('maps rows: app id, payload, decider name, note', async () => {
    listScopedEngagementIds.mockResolvedValue([OWN]);
    batches = [
      [
        {
          id: 'tr-1',
          engagementId: OWN,
          status: 'approved',
          reason: 'Directors travel',
          payload: { phases: [{ id: 'coi', name: 'COI', from: '2026-11-20', to: '2026-11-20' }, { id: 'zz', from: 'x', to: 'y' }], coiFrom: '2026-11-10', coiTo: '2026-11-20', slipDays: 10 },
          createdAt: new Date('2026-10-20T05:00:00Z'),
          updatedAt: new Date('2026-10-21T05:00:00Z'),
          requestedByName: 'Kiran Rao',
          decidedBy: 'mgr-1',
          decidedAt: new Date('2026-10-21T05:00:00Z'),
          decisionNote: ' Fine ',
        },
      ],
      [{ id: 'mgr-1', name: 'Anita Pillai', email: 'pm-anita@demo.vcfo.local' }],
    ];
    const [r] = await listClosedTimelineRequests(ctx('manager'));
    expect(r).toMatchObject({
      id: 'tr-1',
      engagementId: 'e1',
      status: 'approved',
      slipDays: 10,
      coiFrom: '2026-11-10',
      coiTo: '2026-11-20',
      decidedByName: 'Anita Pillai',
      decisionNote: 'Fine',
      requestedByName: 'Kiran Rao',
    });
    expect(r!.phases).toEqual([{ id: 'coi', name: 'COI', from: '2026-11-20', to: '2026-11-20' }]);
  });
});
