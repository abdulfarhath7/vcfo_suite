import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

/**
 * `engagement_managers` membership feeds the manager branch of `scopeFor()`
 * (co-managers). These helpers take no AuthContext — the scope is the key they
 * are handed — so the contract is: filter by exactly that key, and a removal
 * touches only the (engagement, manager) pair, never every manager on the
 * project or every project of the manager.
 */

const selectWheres: SQL[] = [];
const deleteWheres: SQL[] = [];
let selectRows: unknown[] = [];
const inserted: unknown[] = [];

vi.mock('@/db/client', () => ({
  db: {
    select: () => {
      const c = {
        from: () => c,
        where: (w: SQL) => {
          selectWheres.push(w);
          return Promise.resolve(selectRows);
        },
      };
      return c;
    },
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
    delete: () => ({
      where: (w: SQL) => {
        deleteWheres.push(w);
        return Promise.resolve();
      },
    }),
  },
}));

const repo = await import('@/db/repositories/engagement-managers-membership');
const dialect = new PgDialect();
const render = (w: SQL) => dialect.sqlToQuery(w);

beforeEach(() => {
  selectWheres.length = 0;
  deleteWheres.length = 0;
  inserted.length = 0;
  selectRows = [];
});

describe('engagement-managers-membership', () => {
  it('listManagerMemberEngagementIds filters by this manager only', async () => {
    selectRows = [{ engagementId: 'eng-1' }];
    await expect(repo.listManagerMemberEngagementIds('user-mgr')).resolves.toEqual(['eng-1']);
    expect(render(selectWheres[0]!)).toEqual(
      expect.objectContaining({
        sql: '"engagement_managers"."manager_id" = $1',
        params: ['user-mgr'],
      }),
    );
  });

  it('listManagerIdsForEngagement filters by this engagement only', async () => {
    selectRows = [{ managerId: 'm1' }, { managerId: 'm2' }];
    await expect(repo.listManagerIdsForEngagement('eng-1')).resolves.toEqual(['m1', 'm2']);
    expect(render(selectWheres[0]!)).toEqual(
      expect.objectContaining({
        sql: '"engagement_managers"."engagement_id" = $1',
        params: ['eng-1'],
      }),
    );
  });

  it('removeEngagementManager deletes only the (engagement, manager) pair', async () => {
    await repo.removeEngagementManager({ engagementDbId: 'eng-1', managerId: 'm1' });
    expect(render(deleteWheres[0]!)).toEqual(
      expect.objectContaining({
        sql: '("engagement_managers"."engagement_id" = $1 and "engagement_managers"."manager_id" = $2)',
        params: ['eng-1', 'm1'],
      }),
    );
  });

  it('ensureEngagementManager inserts exactly the given pair', async () => {
    await repo.ensureEngagementManager({ engagementDbId: 'eng-1', managerId: 'm1', invitedBy: 'adm' });
    expect(inserted).toEqual([{ engagementId: 'eng-1', managerId: 'm1', invitedBy: 'adm' }]);
  });
});
