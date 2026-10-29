import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { AuthContext } from '@/auth/guards';

/**
 * "Send to client" on the board resolution (S-573): staff only, scoped through
 * `getEngagementById` (a foreign engagement is not found and never updated), and only a
 * finalized document is marked sent.
 */

type Call = { op: string; where?: SQL; set?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    limit: () => c,
    returning: () => c,
    set: (s: unknown) => {
      call.set = s;
      return c;
    },
    where: (w: SQL) => {
      call.where = w;
      return c;
    },
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(results.shift() ?? []).then(res, rej),
  };
  return c;
}
const op = (name: string) => () => {
  const call: Call = { op: name };
  calls.push(call);
  return chain(call);
};
vi.mock('@/db/client', () => ({ db: { select: op('select'), update: op('update'), insert: op('insert'), delete: op('delete') } }));

const OWN = '11111111-1111-4111-8111-111111111101';
const OTHER = '22222222-2222-4222-8222-222222222202';
const getEngagementById = vi.fn();
vi.mock('@/db/repositories/engagements', () => ({
  getEngagementById: (...a: unknown[]) => getEngagementById(...a),
  checklistStateFromRow: () => ({}),
  patchChecklistItem: vi.fn(),
  toAppEngagement: (r: unknown) => r,
}));

const { markBoardResolutionSentToClient } = await import('@/db/repositories/board-resolution');
const dialect = new PgDialect();

function ctx(role: string): AuthContext {
  return { userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role: role as AuthContext['role'] };
}

const finalizedRow = {
  engagementId: OWN,
  content: 'x',
  status: 'finalized',
  storagePath: 'br/own.docx',
  sentToClientAt: new Date('2026-10-29T10:00:00Z'),
  sentToClientBy: 'user-intern',
  updatedAt: new Date(),
};

beforeEach(() => {
  calls.length = 0;
  results = [];
  getEngagementById.mockReset();
  getEngagementById.mockImplementation(async (_c: AuthContext, id: string) => (id === OWN ? { id: OWN } : null));
});

describe('markBoardResolutionSentToClient', () => {
  it.each(['client', 'developer'])('%s is refused before any lookup', async (role) => {
    await expect(markBoardResolutionSentToClient(ctx(role), OWN)).rejects.toThrow(/Only staff/);
    expect(getEngagementById).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it.each(['intern', 'manager', 'admin'])('%s cannot mark another engagement and writes nothing', async (role) => {
    await expect(markBoardResolutionSentToClient(ctx(role), OTHER)).rejects.toThrow(/not found/);
    expect(calls).toHaveLength(0);
  });

  it('marks a finalized document on the approved engagement', async () => {
    results = [[finalizedRow]];
    const doc = await markBoardResolutionSentToClient(ctx('intern'), OWN);
    const u = calls.find((c) => c.op === 'update')!;
    expect(u.set).toMatchObject({ sentToClientBy: 'user-intern' });
    const q = dialect.sqlToQuery(u.where!);
    expect(q.params).toEqual([OWN, 'finalized']);
    expect(doc.sentToClientAt).toBe('2026-10-29T10:00:00.000Z');
  });

  it('refuses a document that is not finalized', async () => {
    results = [[]];
    await expect(markBoardResolutionSentToClient(ctx('manager'), OWN)).rejects.toThrow(/not finalized/);
  });
});
