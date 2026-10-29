import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import type { AuthContext } from '@/auth/guards';

/**
 * Scoping for the obligation About read (G-04): firm-wide admins read any obligation;
 * every other role only one with an instance on an engagement in its scope; a read by
 * instance id needs access to that instance's engagement; a developer gets nothing.
 */

type Call = { op: string; where?: SQL };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    limit: () => c,
    where: (w: SQL) => {
      call.where = w;
      return c;
    },
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(results.shift() ?? []).then(res, rej),
  };
  return c;
}

vi.mock('@/db/client', () => ({
  db: {
    select: () => {
      const call: Call = { op: 'select' };
      calls.push(call);
      return chain(call);
    },
  },
}));

const listScopedEngagementIds = vi.fn();
const assertEngagementAccess = vi.fn();
vi.mock('@/db/repositories/engagements', () => ({
  listScopedEngagementIds: (...a: unknown[]) => listScopedEngagementIds(...a),
  assertEngagementAccess: (...a: unknown[]) => assertEngagementAccess(...a),
}));

const { getObligationAbout } = await import('@/db/repositories/obligation-about');

const dialect = new PgDialect();
const OWN = '11111111-1111-1111-1111-111111111101';
const OTHER = '22222222-2222-2222-2222-222222222202';

function ctx(role: AuthContext['role']): AuthContext {
  return { userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role };
}

const obligationRow = {
  id: 'gst-gstr-3b',
  particular: 'GSTR-3B Filing',
  complianceArea: 'GST',
  authority: 'GST',
  frequency: 'monthly',
  triggerType: 'gst_registration',
  dueRule: { kind: 'nth-day-next-month', day: 20 },
  applicabilityNote: null,
  isConditional: false,
  penaltyRisk: 'medium',
};

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  results = [];
  listScopedEngagementIds.mockResolvedValue([OWN]);
});

describe('getObligationAbout', () => {
  it.each(['admin', 'super_admin'] as const)('%s reads any obligation without a scope lookup', async (role) => {
    results = [[obligationRow]];
    const out = await getObligationAbout(ctx(role), { obligationId: 'gst-gstr-3b' });
    expect(out?.name).toBe('GSTR-3B Filing');
    expect(out?.dueRule).toBe('Due by the 20th of the following month.');
    expect(out?.ifLate).toMatch(/18%/);
    expect(listScopedEngagementIds).not.toHaveBeenCalled();
  });

  it.each(['manager', 'intern', 'client'] as const)('%s needs an instance on a scoped engagement', async (role) => {
    results = [[{ id: 'inst-1' }], [obligationRow]];
    const out = await getObligationAbout(ctx(role), { obligationId: 'gst-gstr-3b' });
    expect(out?.id).toBe('gst-gstr-3b');
    const q = dialect.sqlToQuery(calls[0]!.where!);
    expect(q.params).toContain(OWN);
    expect(q.params).not.toContain(OTHER);
  });

  it.each(['manager', 'intern', 'client'] as const)('%s gets null when no scoped engagement holds it', async (role) => {
    results = [[]];
    expect(await getObligationAbout(ctx(role), { obligationId: 'gst-gstr-3b' })).toBeNull();
    expect(calls).toHaveLength(1);
  });

  it.each(['manager', 'intern', 'client'] as const)('%s with no engagements gets null and no query', async (role) => {
    listScopedEngagementIds.mockResolvedValue([]);
    expect(await getObligationAbout(ctx(role), { obligationId: 'gst-gstr-3b' })).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it.each(['manager', 'intern', 'client'] as const)('%s gets null for an instance on another firm’s engagement', async (role) => {
    results = [[{ engagementId: OTHER, obligationId: 'gst-gstr-3b' }]];
    assertEngagementAccess.mockResolvedValue({ ok: false, dbId: OTHER, forbidden: true });
    expect(await getObligationAbout(ctx(role), { instanceId: 'inst-x' })).toBeNull();
    expect(assertEngagementAccess).toHaveBeenCalledWith(ctx(role), OTHER);
    expect(calls).toHaveLength(1);
  });

  it('reads by instance id when the engagement is accessible', async () => {
    results = [[{ engagementId: OWN, obligationId: 'gst-gstr-3b' }], [obligationRow]];
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: {} });
    expect((await getObligationAbout(ctx('client'), { instanceId: 'inst-1' }))?.id).toBe('gst-gstr-3b');
  });

  it('a developer gets null before any query', async () => {
    expect(await getObligationAbout(ctx('developer' as AuthContext['role']), { obligationId: 'gst-gstr-3b' })).toBeNull();
    expect(calls).toHaveLength(0);
    expect(listScopedEngagementIds).not.toHaveBeenCalled();
  });
});
