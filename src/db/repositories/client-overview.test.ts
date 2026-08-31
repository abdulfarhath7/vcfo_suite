import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthContext } from '@/auth/guards';

/**
 * Cross-tenant scoping test for the client overview aggregate (§7).
 *
 * The aggregate must refuse another tenant's engagement at the FIRST hop —
 * `assertEngagementAccess` — and never reach compliance, audit, or team reads
 * with a foreign engagement id. Asserting "returned null" alone would not prove
 * that; we also assert the downstream readers were never called.
 */

const assertEngagementAccess = vi.fn();
const getMyEngagement = vi.fn();
const listAuditEvents = vi.fn();
const resolveEngagementRecipients = vi.fn();
const dbSelect = vi.fn();

vi.mock('@/db/client', () => ({
  db: {
    select: (...args: unknown[]) => dbSelect(...args),
  },
}));

vi.mock('@/db/repositories/engagements', async () => {
  const actual = await vi.importActual<typeof import('@/db/repositories/engagements')>(
    '@/db/repositories/engagements',
  );
  return {
    ...actual,
    assertEngagementAccess: (...args: unknown[]) => assertEngagementAccess(...args),
    getMyEngagement: (...args: unknown[]) => getMyEngagement(...args),
    checklistStateFromRow: (row: { checklistState?: unknown }) =>
      (row.checklistState ?? {}) as Record<string, never>,
  };
});

vi.mock('@/db/repositories/audit-events', () => ({
  listAuditEvents: (...args: unknown[]) => listAuditEvents(...args),
}));

vi.mock('@/db/repositories/engagement-recipients', () => ({
  resolveEngagementRecipients: (...args: unknown[]) => resolveEngagementRecipients(...args),
}));

const { getClientOverview } = await import('@/db/repositories/client-overview');

const OWN_ENGAGEMENT = '11111111-1111-1111-1111-111111111101';
const OTHER_ENGAGEMENT = '22222222-2222-2222-2222-222222222202';

const clientCtx: AuthContext = {
  userId: 'user-client-a',
  email: 'client@vcfo.local',
  name: 'Client A',
  role: 'client',
  clientId: 'c-a',
};

function engagementRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    slug: 'acme-india',
    companyName: 'Acme India Private Limited',
    companyType: 'foreign',
    entityLegalForm: 'company',
    incorporationDate: null,
    parentEntityName: 'Acme Holdings LLC',
    subsidiaryRegisteredAddress: null,
    clientId: 'c-a',
    clientUserId: 'user-client-a',
    internId: 'i1',
    managerId: null,
    adminId: null,
    stage: 'Pre-Incorporation',
    health: 'on-track',
    checklistState: {},
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
  dbSelect.mockImplementation(() => stubSelect([]));
  listAuditEvents.mockResolvedValue([]);
  resolveEngagementRecipients.mockResolvedValue(null);
});

describe('getClientOverview — cross-tenant scoping', () => {
  it('returns null when the client asks for an engagement they do not own', async () => {
    assertEngagementAccess.mockResolvedValue({
      ok: false,
      dbId: OTHER_ENGAGEMENT,
      forbidden: true,
    });

    const overview = await getClientOverview(clientCtx, OTHER_ENGAGEMENT);

    expect(overview).toBeNull();
    expect(assertEngagementAccess).toHaveBeenCalledWith(clientCtx, OTHER_ENGAGEMENT);
    // No downstream read may run with a foreign engagement id.
    expect(listAuditEvents).not.toHaveBeenCalled();
    expect(resolveEngagementRecipients).not.toHaveBeenCalled();
    expect(dbSelect).not.toHaveBeenCalled();
  });

  it('returns null for a soft-deleted or unknown engagement without leaking existence', async () => {
    assertEngagementAccess.mockResolvedValue({
      ok: false,
      dbId: OTHER_ENGAGEMENT,
      notFound: true,
    });

    await expect(getClientOverview(clientCtx, OTHER_ENGAGEMENT)).resolves.toBeNull();
    expect(dbSelect).not.toHaveBeenCalled();
  });

  it('never falls back to another engagement when the client has none', async () => {
    getMyEngagement.mockResolvedValue(null);

    const overview = await getClientOverview(clientCtx);

    expect(overview).toBeNull();
    expect(assertEngagementAccess).not.toHaveBeenCalled();
    expect(dbSelect).not.toHaveBeenCalled();
  });

  it('re-checks access even for the engagement getMyEngagement handed back', async () => {
    getMyEngagement.mockResolvedValue({ id: OWN_ENGAGEMENT });
    assertEngagementAccess.mockResolvedValue({
      ok: false,
      dbId: OWN_ENGAGEMENT,
      forbidden: true,
    });

    await expect(getClientOverview(clientCtx)).resolves.toBeNull();
    expect(assertEngagementAccess).toHaveBeenCalledWith(clientCtx, OWN_ENGAGEMENT);
  });

  it('scopes every downstream read to the approved engagement id', async () => {
    assertEngagementAccess.mockResolvedValue({
      ok: true,
      dbId: OWN_ENGAGEMENT,
      row: engagementRow(OWN_ENGAGEMENT),
    });

    const overview = await getClientOverview(clientCtx, 'e1');

    expect(overview).not.toBeNull();
    expect(listAuditEvents).toHaveBeenCalledWith(clientCtx, {
      engagementId: OWN_ENGAGEMENT,
      limit: 40,
    });
    expect(resolveEngagementRecipients).toHaveBeenCalledWith(OWN_ENGAGEMENT);
    // Legacy demo ids round-trip: the caller asked with `e1`, the aggregate
    // reports the app id back rather than the raw uuid.
    expect(overview?.engagement.id).toBe('e1');
  });
});

describe('getClientOverview — shape', () => {
  beforeEach(() => {
    assertEngagementAccess.mockResolvedValue({
      ok: true,
      dbId: OWN_ENGAGEMENT,
      row: engagementRow(OWN_ENGAGEMENT),
    });
  });

  it('reports pre-incorporation before a CIN or incorporation date exists', async () => {
    const overview = await getClientOverview(clientCtx, OWN_ENGAGEMENT);

    expect(overview?.incorporated).toBe(false);
    expect(overview?.identifiers.cin).toBeUndefined();
    expect(overview?.progress.total).toBeGreaterThan(0);
    expect(overview?.progress.overallPct).toBe(0);
  });

  it('flips to post-incorporation once pre-12 carries the CIN', async () => {
    assertEngagementAccess.mockResolvedValue({
      ok: true,
      dbId: OWN_ENGAGEMENT,
      row: engagementRow(OWN_ENGAGEMENT, {
        incorporationDate: '2026-04-01',
        checklistState: {
          'pre-12': {
            status: 'completed',
            responses: { cin: 'U74999KA2026PTC123456', pan: 'AAACA1234A' },
          },
        },
      }),
    });

    const overview = await getClientOverview(clientCtx, OWN_ENGAGEMENT);

    expect(overview?.incorporated).toBe(true);
    expect(overview?.identifiers.cin).toBe('U74999KA2026PTC123456');
    expect(overview?.identifiers.pan).toBe('AAACA1234A');
    expect(overview?.engagement.incorporationDate).toBe('2026-04-01');
  });
});
