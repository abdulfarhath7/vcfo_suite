import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthContext } from '@/auth/guards';

/**
 * Cross-tenant scoping test for the filings register (§7).
 *
 * The register is one function serving all five roles, so the scope is the only
 * thing standing between a client and another company's filings. These assert
 * that it holds at the query level: the id list handed to the WHERE clause is
 * always the caller's own scope, and naming someone else's engagement yields
 * nothing rather than their rows.
 */

const listScopedEngagementIds = vi.fn();
const assertEngagementAccess = vi.fn();
let capturedWhere: unknown;
let selectRows: unknown[] = [];

vi.mock('@/db/client', () => ({
  db: {
    select: () => {
      const chain = {
        from: () => chain,
        innerJoin: () => chain,
        where: (clause: unknown) => {
          capturedWhere = clause;
          return chain;
        },
        orderBy: () => Promise.resolve(selectRows),
      };
      return chain;
    },
  },
}));

vi.mock('@/db/repositories/engagements', () => ({
  listScopedEngagementIds: (...args: unknown[]) => listScopedEngagementIds(...args),
  assertEngagementAccess: (...args: unknown[]) => assertEngagementAccess(...args),
}));

// Capture what `inArray` was given, which is the whole point of the test.
let inArrayIds: string[] = [];
vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm');
  return {
    ...actual,
    inArray: (_column: unknown, ids: string[]) => {
      inArrayIds = ids;
      return { __inArray: ids };
    },
    and: (...parts: unknown[]) => ({ __and: parts }),
    eq: () => ({ __eq: true }),
    gte: (_c: unknown, v: unknown) => ({ __gte: v }),
    lte: (_c: unknown, v: unknown) => ({ __lte: v }),
    asc: () => ({ __asc: true }),
  };
});

const { getFilings } = await import('@/db/repositories/filings');

const OWN = '11111111-1111-1111-1111-111111111101';
const OTHER = '22222222-2222-2222-2222-222222222202';

const clientCtx: AuthContext = {
  userId: 'user-client-a',
  email: 'client@vcfo.local',
  name: 'Client A',
  role: 'client',
  clientId: 'c-a',
};

beforeEach(() => {
  vi.clearAllMocks();
  capturedWhere = undefined;
  inArrayIds = [];
  selectRows = [];
  listScopedEngagementIds.mockResolvedValue([OWN]);
});

describe('getFilings — scoping', () => {
  it('restricts every read to the caller’s own engagement ids', async () => {
    await getFilings(clientCtx);

    expect(listScopedEngagementIds).toHaveBeenCalledWith(clientCtx);
    expect(inArrayIds).toEqual([OWN]);
    expect(capturedWhere).toBeDefined();
  });

  it('returns nothing — and queries nothing — when the caller has no scope', async () => {
    listScopedEngagementIds.mockResolvedValue([]);

    const result = await getFilings(clientCtx);

    expect(result).toEqual({ rows: [], companies: [] });
    expect(capturedWhere).toBeUndefined();
  });

  it('refuses another company’s engagement id', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: false, dbId: OTHER, forbidden: true });

    const result = await getFilings(clientCtx, { engagementId: OTHER });

    expect(result).toEqual({ rows: [], companies: [] });
    // Never reached the database with the foreign id.
    expect(capturedWhere).toBeUndefined();
  });

  it('refuses an engagement that passes the access check but is outside role scope', async () => {
    // Defence in depth: access says yes, the role scope does not list it.
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OTHER, row: {} });

    const result = await getFilings(clientCtx, { engagementId: OTHER });

    expect(result).toEqual({ rows: [], companies: [] });
    expect(capturedWhere).toBeUndefined();
  });

  it('narrows to a single engagement the caller does own', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: {} });

    await getFilings(clientCtx, { engagementId: OWN });

    expect(inArrayIds).toEqual([OWN]);
  });
});

describe('getFilings — shape', () => {
  beforeEach(() => {
    selectRows = [
      {
        id: 'ci-1',
        engagementId: OWN,
        dueDate: '2026-09-11',
        filedOn: null,
        periodLabel: 'Aug 2026',
        fyLabel: 'FY 2026-27',
        status: 'upcoming',
        companyName: 'Acme India Private Limited',
        compliance: 'GST',
        particular: 'GSTR-1',
        authority: 'GST',
        frequency: 'monthly',
      },
      {
        id: 'ci-2',
        engagementId: OWN,
        dueDate: '2026-08-20',
        filedOn: '2026-08-18',
        periodLabel: 'Jul 2026',
        fyLabel: 'FY 2026-27',
        status: 'filed',
        companyName: 'Acme India Private Limited',
        compliance: 'GST',
        particular: 'GSTR-3B',
        authority: 'GST',
        frequency: 'monthly',
      },
    ];
  });

  it('maps instances onto register rows, keeping filed dates as stored', async () => {
    const result = await getFilings(clientCtx);

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      id: 'ci-1',
      compliance: 'GST',
      particular: 'GSTR-1',
      dueDate: '2026-09-11',
      filedOn: null,
      frequency: 'monthly',
    });
    expect(result.rows[1]?.filedOn).toBe('2026-08-18');
  });

  it('lists the companies in scope once, for the firm-wide selector', async () => {
    const result = await getFilings(clientCtx);
    expect(result.companies).toEqual([
      { engagementId: 'e1', companyName: 'Acme India Private Limited' },
    ]);
  });

  it('bounds the query to the financial year when one is asked for', async () => {
    await getFilings(clientCtx, { fyStartYear: 2026 });
    // Apr 2026 → Mar 2027, the Indian FY the deck is laid out on.
    expect(JSON.stringify(capturedWhere)).toContain('2026-04-01');
    expect(JSON.stringify(capturedWhere)).toContain('2027-03-31');
  });
});
