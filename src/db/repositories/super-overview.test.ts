import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthContext } from '@/auth/guards';

/**
 * Scoping test for the super admin aggregate (context §7).
 *
 * Two things must hold:
 *   1. A non-firm-wide role cannot read this aggregate at all — it must throw
 *      before any engagement, profile, audit or compliance row is touched.
 *      Asserting "returned nothing" would not prove that, so we also assert the
 *      downstream readers were never called.
 *   2. For a super admin, every read is still the role-scoped repository read
 *      (never a raw firm-wide query bolted on here), and the compliance query
 *      is restricted to the engagement ids the engagement scope just approved.
 */

const listEngagements = vi.fn();
const listChecklistIndex = vi.fn();
const listStaffPeople = vi.fn();
const listAuditEvents = vi.fn();
const dbSelect = vi.fn();
const inArrayCalls: unknown[][] = [];

vi.mock('@/db/client', () => ({
  db: { select: (...args: unknown[]) => dbSelect(...args) },
}));

vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm');
  return {
    ...actual,
    inArray: (column: unknown, values: unknown[]) => {
      inArrayCalls.push(values);
      return actual.inArray(column as never, values as never);
    },
  };
});

vi.mock('@/db/repositories/engagements', async () => {
  const actual = await vi.importActual<typeof import('@/db/repositories/engagements')>(
    '@/db/repositories/engagements',
  );
  return {
    ...actual,
    listEngagements: (...args: unknown[]) => listEngagements(...args),
    listChecklistIndex: (...args: unknown[]) => listChecklistIndex(...args),
  };
});

vi.mock('@/db/repositories/profiles', () => ({
  listStaffPeople: (...args: unknown[]) => listStaffPeople(...args),
}));

vi.mock('@/db/repositories/audit-events', () => ({
  listAuditEvents: (...args: unknown[]) => listAuditEvents(...args),
}));

const { getSuperAdminOverview } = await import('@/db/repositories/super-overview');

const ENGAGEMENT_A = '11111111-1111-1111-1111-111111111101';
const ENGAGEMENT_B = '22222222-2222-2222-2222-222222222202';

const superCtx: AuthContext = {
  userId: 'user-super',
  email: 'super@vcfo.local',
  name: 'Super Admin',
  role: 'super_admin',
};

const managerCtx: AuthContext = {
  userId: 'user-manager',
  email: 'pm@vcfo.local',
  name: 'Project Manager',
  role: 'manager',
};

const clientCtx: AuthContext = {
  userId: 'user-client',
  email: 'client@vcfo.local',
  name: 'Client',
  role: 'client',
  clientId: 'c-a',
};

function engagementRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    slug: 'acme-india',
    companyName: 'Acme India Private Limited',
    clientName: 'Acme Holdings',
    clientId: 'c-a',
    clientUserId: 'user-client',
    internId: 'i1',
    managerId: 'user-manager',
    adminId: null,
    stage: 'Pre-Incorporation',
    health: 'on-track',
    incorporationDate: null,
    createdAt: new Date('2026-01-05T00:00:00.000Z'),
    updatedAt: new Date('2026-01-05T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

/** Minimal chainable Drizzle stub — every select resolves to `rows`. */
function stubSelect(rows: unknown[] = []) {
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => Promise.resolve(rows),
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
  };
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  inArrayCalls.length = 0;
  dbSelect.mockImplementation(() => stubSelect([]));
  listEngagements.mockResolvedValue([]);
  listChecklistIndex.mockResolvedValue({});
  listStaffPeople.mockResolvedValue([]);
  listAuditEvents.mockResolvedValue([]);
});

describe('getSuperAdminOverview — access', () => {
  it.each([
    ['manager', managerCtx],
    ['client', clientCtx],
  ])('refuses a %s before reading anything', async (_label, ctx) => {
    await expect(getSuperAdminOverview(ctx)).rejects.toThrow(/firm-wide/i);

    expect(listEngagements).not.toHaveBeenCalled();
    expect(listChecklistIndex).not.toHaveBeenCalled();
    expect(listStaffPeople).not.toHaveBeenCalled();
    expect(listAuditEvents).not.toHaveBeenCalled();
    expect(dbSelect).not.toHaveBeenCalled();
  });

  it('reads through the role-scoped repositories, passing the caller context', async () => {
    listEngagements.mockResolvedValue([engagementRow(ENGAGEMENT_A)]);

    await getSuperAdminOverview(superCtx);

    expect(listEngagements).toHaveBeenCalledWith(superCtx);
    expect(listChecklistIndex).toHaveBeenCalledWith(superCtx);
    expect(listStaffPeople).toHaveBeenCalledWith(superCtx);
    expect(listAuditEvents).toHaveBeenCalledWith(superCtx, { limit: 60 });
  });

  it('scopes the compliance read to the engagement ids the scope approved', async () => {
    listEngagements.mockResolvedValue([
      engagementRow(ENGAGEMENT_A),
      engagementRow(ENGAGEMENT_B, { companyName: 'Beta Labs Private Limited' }),
    ]);

    await getSuperAdminOverview(superCtx);

    expect(inArrayCalls[0]).toEqual([ENGAGEMENT_A, ENGAGEMENT_B]);
  });

  it('never queries compliance when the scope returned no engagements', async () => {
    listEngagements.mockResolvedValue([]);

    await getSuperAdminOverview(superCtx);

    expect(dbSelect).not.toHaveBeenCalled();
  });
});

describe('getSuperAdminOverview — shape', () => {
  it('summarises an untouched engagement as all-locked, nothing done', async () => {
    listEngagements.mockResolvedValue([engagementRow(ENGAGEMENT_A)]);
    listStaffPeople.mockResolvedValue([
      {
        id: 'user-lead',
        name: 'Priya Lead',
        email: 'priya@vcfo.local',
        role: 'intern',
        internId: 'i1',
        clientId: null,
        reportsToManagerId: null,
        status: 'active',
      },
    ]);

    const overview = await getSuperAdminOverview(superCtx, new Date('2026-02-01T00:00:00.000Z'));

    expect(overview.kpis.engagements).toBe(1);
    expect(overview.engagements).toHaveLength(1);

    const summary = overview.engagements[0]!;
    expect(summary.progress.done).toBe(0);
    expect(summary.progress.total).toBeGreaterThan(0);
    expect(summary.leadName).toBe('Priya Lead');
    // Exactly one step is open at the start of the journey; the rest are locked
    // behind it, which is what the gate says everywhere else in the product.
    expect(summary.steps.active + summary.steps.waiting).toBe(1);
    expect(summary.steps.locked).toBe(summary.progress.total - 1);
    expect(summary.currentStep?.id).toBeTruthy();
    // Legacy demo ids round-trip: the row carries a uuid, the surface links by
    // the app id, exactly as the client overview does.
    expect(summary.id).toBe('e1');
    expect(summary.href).toBe('/app/super/projects/e1');
  });

  it('counts an engagement with nothing moving as needing attention', async () => {
    listEngagements.mockResolvedValue([engagementRow(ENGAGEMENT_A)]);

    const overview = await getSuperAdminOverview(superCtx);

    expect(overview.kpis.needsAttention).toBe(1);
    expect(overview.needsAttention).toHaveLength(1);
    expect(overview.charts.byStage.find((bar) => bar.stage === 'Pre-Incorporation')?.attention).toBe(1);
  });

  it('attributes workload to the delivery lead, and to "Unassigned" without one', async () => {
    listEngagements.mockResolvedValue([
      engagementRow(ENGAGEMENT_A),
      engagementRow(ENGAGEMENT_B, { internId: null, companyName: 'Beta Labs' }),
    ]);

    const overview = await getSuperAdminOverview(superCtx);

    expect(overview.charts.workload.map((row) => row.id).sort()).toEqual(['i1', 'unassigned']);
  });

  it('hides draft-save churn from the firm activity feed', async () => {
    listEngagements.mockResolvedValue([engagementRow(ENGAGEMENT_A)]);
    listAuditEvents.mockResolvedValue([
      {
        id: 'a1',
        created_at: '2026-02-01T10:00:00.000Z',
        actor_user_id: 'user-lead',
        actor_role: 'intern',
        actor_email: 'priya@vcfo.local',
        actor_name: 'Priya Lead',
        engagement_id: ENGAGEMENT_A,
        action: 'engagement.checklist.save_draft',
        summary: 'Saved a draft',
        metadata: {},
      },
      {
        id: 'a2',
        created_at: '2026-02-01T11:00:00.000Z',
        actor_user_id: 'user-lead',
        actor_role: 'intern',
        actor_email: 'priya@vcfo.local',
        actor_name: 'Priya Lead',
        engagement_id: ENGAGEMENT_A,
        action: 'engagement.checklist.submit',
        summary: 'Submitted Name Application',
        metadata: {},
      },
    ]);

    const overview = await getSuperAdminOverview(superCtx);

    expect(overview.activity.map((entry) => entry.id)).toEqual(['a2']);
    expect(overview.activity[0]?.companyName).toBe('Acme India Private Limited');
  });
});
