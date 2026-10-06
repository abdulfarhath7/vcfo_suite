import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

/**
 * `engagement_leads` membership feeds the intern branch of `scopeFor()` and
 * `assertEngagementAccess()`. These helpers take no AuthContext — the scope is
 * the key they are handed — so the contract is: filter by exactly that key,
 * never widen. An empty id list must not become an unfiltered query.
 */

const wheres: SQL[] = [];
let selectRows: unknown[] = [];
const dbSelect = vi.fn();
const inserted: unknown[] = [];

vi.mock('@/db/client', () => ({
  db: {
    select: (...a: unknown[]) => dbSelect(...a),
    insert: () => {
      const c = {
        values: (v: unknown) => {
          inserted.push(v);
          return c;
        },
        onConflictDoNothing: () => Promise.resolve(),
      };
      return c;
    },
  },
}));

const repo = await import('@/db/repositories/engagement-leads-membership');
const dialect = new PgDialect();
const render = (w: SQL) => dialect.sqlToQuery(w);

beforeEach(() => {
  vi.clearAllMocks();
  wheres.length = 0;
  inserted.length = 0;
  selectRows = [];
  dbSelect.mockImplementation(() => {
    const c = {
      from: () => c,
      where: (w: SQL) => {
        wheres.push(w);
        return Promise.resolve(selectRows);
      },
    };
    return c;
  });
});

describe('listLeadMemberEngagementIds', () => {
  it('returns only engagements where this intern_id is a lead', async () => {
    selectRows = [{ engagementId: 'eng-1' }, { engagementId: 'eng-2' }];
    await expect(repo.listLeadMemberEngagementIds('i-own')).resolves.toEqual(['eng-1', 'eng-2']);
    expect(render(wheres[0]!)).toEqual(
      expect.objectContaining({ sql: '"engagement_leads"."intern_id" = $1', params: ['i-own'] }),
    );
  });
});

describe('listLeadIdsByEngagementIds', () => {
  it('an empty id list returns an empty map without querying', async () => {
    const out = await repo.listLeadIdsByEngagementIds([]);
    expect(out.size).toBe(0);
    expect(dbSelect).not.toHaveBeenCalled();
  });

  it('filters to the given engagements and groups leads per engagement', async () => {
    selectRows = [
      { engagementId: 'eng-1', internId: 'i1' },
      { engagementId: 'eng-1', internId: 'i2' },
      { engagementId: 'eng-2', internId: 'i3' },
    ];
    const out = await repo.listLeadIdsByEngagementIds(['eng-1', 'eng-2']);
    expect(render(wheres[0]!)).toEqual(
      expect.objectContaining({
        sql: '"engagement_leads"."engagement_id" in ($1, $2)',
        params: ['eng-1', 'eng-2'],
      }),
    );
    expect(Object.fromEntries(out)).toEqual({ 'eng-1': ['i1', 'i2'], 'eng-2': ['i3'] });
  });
});

describe('ensureEngagementLead', () => {
  it('inserts exactly the given pair, defaulting invitedBy to null', async () => {
    await repo.ensureEngagementLead({ engagementDbId: 'eng-1', internId: 'i1' });
    expect(inserted).toEqual([{ engagementId: 'eng-1', internId: 'i1', invitedBy: null }]);
  });
});
