import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

/**
 * `resolveEngagementRecipients` takes no AuthContext — callers run it after
 * authorising the engagement — so its tenant boundary is that every party it
 * returns is pulled through THAT engagement's own row and membership tables:
 *   - members are read for the loaded row's db id, never the raw slug/app id,
 *   - a lead key only ever resolves to a profile with role = 'intern',
 *   - an unknown engagement yields null and no party lookups,
 *   - the admin CC list is limited to active admin / super_admin profiles.
 */

const listLeadIdsByEngagementIds = vi.fn();
const listManagerIdsForEngagement = vi.fn();

type Q = { sql: string; params: unknown[] };
const dialect = new PgDialect();
const queries: Q[] = [];
let route: (q: Q) => unknown[] = () => [];

function selectChain(): unknown {
  let q: Q | undefined;
  const c: Record<string, unknown> = {
    from: () => c,
    innerJoin: () => c,
    where: (w: SQL) => {
      q = dialect.sqlToQuery(w);
      queries.push(q);
      return c;
    },
    limit: () => c,
    then: (resolve: (v: unknown[]) => unknown) => resolve(q ? route(q) : []),
  };
  return c;
}

vi.mock('@/db/client', () => ({ db: { select: () => selectChain() } }));
vi.mock('@/db/repositories/engagement-leads-membership', () => ({
  listLeadIdsByEngagementIds: (...a: unknown[]) => listLeadIdsByEngagementIds(...a),
}));
vi.mock('@/db/repositories/engagement-managers-membership', () => ({
  listManagerIdsForEngagement: (...a: unknown[]) => listManagerIdsForEngagement(...a),
}));

const { resolveEngagementRecipients } = await import('@/db/repositories/engagement-recipients');

// Must satisfy `isUuid` (version + variant nibbles), or the repo treats them as slugs.
const ENG = '33333333-3333-4333-8333-333333333301';
const CLIENT = '55555555-5555-4555-8555-555555555501';
const MANAGER = '66666666-6666-4666-8666-666666666601';

function party(id: string, email: string) {
  return { id, email, name: email, phoneE164: null, whatsappOptInAt: null, whatsappOptOutAt: null };
}

const engagementRow = {
  id: ENG,
  slug: 'acme',
  companyName: 'Acme',
  clientUserId: CLIENT,
  internId: 'i1',
  managerId: MANAGER,
  adminId: null,
  progressCcEmails: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  queries.length = 0;
  listLeadIdsByEngagementIds.mockResolvedValue(new Map([[ENG, ['i1']]]));
  listManagerIdsForEngagement.mockResolvedValue([]);
  route = (q) => {
    if (q.sql.includes('"engagements"."slug"')) return q.params[0] === 'acme' ? [engagementRow] : [];
    if (q.sql.includes('"engagements"."id"')) return q.params[0] === ENG ? [engagementRow] : [];
    if (q.sql.includes('"engagement_clients"')) return [party(CLIENT, 'client@acme.test')];
    if (q.sql.includes('"profiles"."role" in')) return [party('adm', 'admin@firm.test')];
    if (q.sql.includes('"profiles"."intern_id"')) return [party('lead-1', 'lead@firm.test')];
    if (q.params[0] === CLIENT) return [party(CLIENT, 'client@acme.test')];
    if (q.params[0] === MANAGER) return [party(MANAGER, 'pm@firm.test')];
    return [];
  };
});

describe('resolveEngagementRecipients', () => {
  it('unknown engagement → null, and no party lookups', async () => {
    await expect(resolveEngagementRecipients('no-such-slug')).resolves.toBeNull();
    expect(queries.every((q) => q.sql.includes('"engagements"'))).toBe(true);
    expect(listLeadIdsByEngagementIds).not.toHaveBeenCalled();
    expect(listManagerIdsForEngagement).not.toHaveBeenCalled();
  });

  it('a non-UUID route param is never compared against engagements.id', async () => {
    await resolveEngagementRecipients('acme');
    expect(queries[0]).toEqual({ sql: '"engagements"."slug" = $1', params: ['acme'], typings: expect.anything() });
    expect(queries.some((q) => q.sql === '"engagements"."id" = $1')).toBe(false);
  });

  it('reads members and memberships for the loaded row id, not the slug sent', async () => {
    const out = await resolveEngagementRecipients('acme');
    const members = queries.find((q) => q.sql.includes('"engagement_clients"'))!;
    expect(members).toMatchObject({ sql: '"engagement_clients"."engagement_id" = $1', params: [ENG] });
    expect(listLeadIdsByEngagementIds).toHaveBeenCalledWith([ENG]);
    expect(listManagerIdsForEngagement).toHaveBeenCalledWith(ENG);
    expect(out).toMatchObject({ dbId: ENG, client: { userId: CLIENT }, manager: { userId: MANAGER } });
  });

  it('lead keys only resolve to role = intern profiles; a non-UUID key never ORs on profiles.id', async () => {
    await resolveEngagementRecipients(ENG);
    const leadQueries = queries.filter((q) => q.sql.includes('"profiles"."intern_id"'));
    expect(leadQueries.length).toBeGreaterThan(0);
    for (const q of leadQueries) {
      expect(q.sql).toBe('("profiles"."role" = $1 and "profiles"."intern_id" = $2)');
      expect(q.params).toEqual(['intern', 'i1']);
    }
  });

  it('admin CC list is limited to active admin / super_admin profiles', async () => {
    const out = await resolveEngagementRecipients(ENG);
    const admins = queries.find((q) => q.sql.includes('"profiles"."role" in'))!;
    expect(admins.sql).toBe('("profiles"."role" in ($1, $2) and "profiles"."status" = $3)');
    expect(admins.params).toEqual(['admin', 'super_admin', 'active']);
    expect(out?.admins.map((a) => a.userId)).toEqual(['adm']);
  });
});
