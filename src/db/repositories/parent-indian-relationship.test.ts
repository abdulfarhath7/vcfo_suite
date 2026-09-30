import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthContext } from '@/auth/guards';

/**
 * Invariant for `parent_indian_relationship`, enforced in the repository (the
 * zod schema only guards the create route):
 *   - required for an Indian subsidiary (subsidiary + domestic),
 *   - forced to null for Standalone or a Foreign parent,
 *   - a legacy Group + Indian row with no role still accepts unrelated patches.
 */

let selectRows: unknown[] = [];
const insertValues: Record<string, unknown>[] = [];
const updateSets: Record<string, unknown>[] = [];

/** Chainable stub: every builder method returns a thenable resolving to `rows()`. */
function chain(rows: () => unknown[]): unknown {
  const self: Record<string, unknown> = {
    then: (resolve: (value: unknown[]) => unknown) => resolve(rows()),
  };
  for (const m of ['from', 'where', 'limit', 'orderBy', 'returning']) {
    self[m] = () => self;
  }
  return self;
}

vi.mock('server-only', () => ({}));

vi.mock('@/db/client', () => ({
  db: {
    select: () => chain(() => selectRows),
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        insertValues.push(v);
        return chain(() => [
          { id: 'eng-1', createdAt: new Date('2026-09-29'), internId: 'lead-1', ...v },
        ]);
      },
    }),
    update: () => ({
      set: (v: Record<string, unknown>) => {
        updateSets.push(v);
        return chain(() => [{ ...(selectRows[0] as object), ...v }]);
      },
    }),
    delete: () => chain(() => []),
  },
}));

vi.mock('@/db/repositories/profiles', () => ({
  resolveInternScopingId: async (key: string) => key,
  createClientProfile: async () => ({
    clientId: 'client-1',
    userId: 'client-user-1',
    email: 'c@example.com',
    name: 'Client',
  }),
}));

vi.mock('@/db/repositories/engagement-clients', () => ({
  ensureEngagementClientMember: async () => undefined,
  listClientMemberEngagementIds: async () => [],
}));
vi.mock('@/db/repositories/engagement-leads-membership', () => ({
  ensureEngagementLead: async () => undefined,
  listLeadIdsByEngagementIds: async () => new Map(),
  listLeadMemberEngagementIds: async () => [],
}));
vi.mock('@/db/repositories/engagement-managers-membership', () => ({
  ensureEngagementManager: async () => undefined,
  listManagerMemberEngagementIds: async () => [],
}));

const { createProjectWithClient, updateEngagement } = await import(
  '@/db/repositories/engagements'
);
const { createProjectBodySchema } = await import('@/lib/api/schemas');

const admin = {
  userId: '11111111-1111-1111-1111-111111111111',
  email: 'admin@vcfo.local',
  name: 'Admin',
  role: 'admin',
  internId: null,
  clientId: null,
} as AuthContext;

const baseCreate = {
  companyName: 'Acme Pvt Ltd',
  clientEmail: 'c@example.com',
  clientPassword: 'SBC@2026',
  internIds: ['lead-1'],
  managerId: '22222222-2222-4222-8222-222222222222',
};

function existingRow(over: Record<string, unknown>) {
  return {
    id: 'eng-1',
    ownershipType: 'subsidiary',
    companyType: 'domestic',
    parentIndianRelationship: null,
    ...over,
  };
}

beforeEach(() => {
  selectRows = [];
  insertValues.length = 0;
  updateSets.length = 0;
});

describe('create', () => {
  it('Group + Indian + investing persists the relationship', async () => {
    const res = await createProjectWithClient(admin, {
      ...baseCreate,
      companyType: 'domestic',
      ownershipType: 'subsidiary',
      parentIndianRelationship: 'investing',
    });
    expect(insertValues[0]?.parentIndianRelationship).toBe('investing');
    expect(res.engagement.parentIndianRelationship).toBe('investing');
  });

  it('Group + Foreign drops a stray relationship', async () => {
    await createProjectWithClient(admin, {
      ...baseCreate,
      companyType: 'foreign',
      ownershipType: 'subsidiary',
      parentIndianRelationship: 'name_only',
    });
    expect(insertValues[0]?.parentIndianRelationship).toBeNull();
  });

  it('Standalone drops a stray relationship', async () => {
    await createProjectWithClient(admin, {
      ...baseCreate,
      companyType: 'foreign',
      ownershipType: 'independent',
      parentIndianRelationship: 'investing',
    });
    expect(insertValues[0]?.companyType).toBe('domestic');
    expect(insertValues[0]?.parentIndianRelationship).toBeNull();
  });

  it('Group + Indian without it is rejected before any write', async () => {
    await expect(
      createProjectWithClient(admin, {
        ...baseCreate,
        companyType: 'domestic',
        ownershipType: 'subsidiary',
      }),
    ).rejects.toThrow('parent_indian_relationship_required');
    expect(insertValues).toHaveLength(0);
  });

  it('create body schema rejects Group + Indian without it (route → 400)', () => {
    const parsed = createProjectBodySchema.safeParse({
      ...baseCreate,
      companyType: 'domestic',
      ownershipType: 'subsidiary',
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((i) => i.path.join('.'))).toContain(
      'parentIndianRelationship',
    );
  });

  it('create body schema accepts Standalone and Foreign without it', () => {
    for (const [ownershipType, companyType] of [
      ['independent', 'domestic'],
      ['subsidiary', 'foreign'],
    ]) {
      expect(
        createProjectBodySchema.safeParse({ ...baseCreate, ownershipType, companyType }).success,
      ).toBe(true);
    }
  });
});

describe('patch', () => {
  it('switching to a Foreign parent clears it', async () => {
    selectRows = [existingRow({ parentIndianRelationship: 'investing' })];
    await updateEngagement(admin, 'eng-1', { companyType: 'foreign' });
    expect(updateSets[0]?.parentIndianRelationship).toBeNull();
  });

  it('switching to Standalone clears it', async () => {
    selectRows = [existingRow({ parentIndianRelationship: 'name_only' })];
    await updateEngagement(admin, 'eng-1', { ownershipType: 'independent' });
    expect(updateSets[0]?.parentIndianRelationship).toBeNull();
  });

  it('switching Foreign → Indian without a role is rejected', async () => {
    selectRows = [existingRow({ companyType: 'foreign' })];
    await expect(
      updateEngagement(admin, 'eng-1', { companyType: 'domestic' }),
    ).rejects.toThrow('parent_indian_relationship_required');
    expect(updateSets).toHaveLength(0);
  });

  it('choosing a role on a legacy Group + Indian row persists it', async () => {
    selectRows = [existingRow({})];
    await updateEngagement(admin, 'eng-1', { parentIndianRelationship: 'name_only' });
    expect(updateSets[0]?.parentIndianRelationship).toBe('name_only');
  });

  it('a legacy Group + Indian row with no role still accepts unrelated patches', async () => {
    selectRows = [existingRow({})];
    await updateEngagement(admin, 'eng-1', { stage: 'Post-Incorporation' });
    expect(updateSets[0]).not.toHaveProperty('parentIndianRelationship');
  });
});
