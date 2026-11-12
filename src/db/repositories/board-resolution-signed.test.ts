import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { AuthContext } from '@/auth/guards';

/**
 * Signed copy of the board resolution (S-574): the client and staff may store it, a developer may
 * not; the engagement is read through `getEngagementById`, so a foreign engagement is not found
 * and nothing is written; only a finalized document takes a signed copy.
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

const { getBoardResolutionByEngagementId, setSignedBoardResolution, signedUploaderDisplayName } = await import('@/db/repositories/board-resolution');
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

describe('setSignedBoardResolution', () => {
  it('a developer is refused before any lookup', async () => {
    await expect(setSignedBoardResolution(ctx('developer'), OWN, 'br/signed.pdf')).rejects.toThrow(/Only the client or staff/);
    expect(getEngagementById).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it.each(['client', 'intern', 'manager', 'admin', 'super_admin'])('%s cannot store a copy on another engagement', async (role) => {
    await expect(setSignedBoardResolution(ctx(role), OTHER, 'br/signed.pdf')).rejects.toThrow(/not found/);
    expect(calls.filter((c) => c.op === 'update')).toHaveLength(0);
  });

  it('a manager stores the signed copy on the approved engagement', async () => {
    results = [[finalizedRow], [{ ...finalizedRow, signedStoragePath: 'br/signed.pdf', signedUploadedAt: new Date('2026-10-30T09:00:00Z'), signedUploadedBy: 'user-manager' }]];
    const doc = await setSignedBoardResolution(ctx('manager'), OWN, 'br/signed.pdf');
    const u = calls.find((c) => c.op === 'update')!;
    expect(u.set).toMatchObject({ signedStoragePath: 'br/signed.pdf', signedUploadedBy: 'user-manager' });
    expect(dialect.sqlToQuery(u.where!).params).toEqual([OWN]);
    expect(doc.signedStoragePath).toBe('br/signed.pdf');
  });

  it('refuses a draft', async () => {
    results = [[{ ...finalizedRow, status: 'draft' }]];
    await expect(setSignedBoardResolution(ctx('intern'), OWN, 'br/signed.pdf')).rejects.toThrow(/not finalized/);
    expect(calls.filter((c) => c.op === 'update')).toHaveLength(0);
  });
});

describe('who uploaded the signed copy (BR-02)', () => {
  const UPLOADER = '33333333-3333-4333-8333-333333333303';
  const signedRow = { ...finalizedRow, signedStoragePath: 'br/signed.pdf', signedUploadedAt: new Date('2026-10-30T09:00:00Z'), signedUploadedBy: UPLOADER };

  it('the repository resolves the uploader through the engagement it may read', async () => {
    results = [[signedRow], [{ name: 'Divya Rao', email: 'divya@sbc.test', role: 'intern' }]];
    const doc = await getBoardResolutionByEngagementId(ctx('manager'), OWN);
    expect(doc?.signedUploadedByName).toBe('Divya Rao');
    expect(calls.filter((c) => c.op === 'select')).toHaveLength(2);
  });

  it('a foreign engagement reads nothing, not even the name', async () => {
    const doc = await getBoardResolutionByEngagementId(ctx('client'), OTHER);
    expect(doc).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('no uploader means no profile lookup', async () => {
    results = [[finalizedRow]];
    const doc = await getBoardResolutionByEngagementId(ctx('intern'), OWN);
    expect(doc?.signedUploadedByName).toBeUndefined();
    expect(calls.filter((c) => c.op === 'select')).toHaveLength(1);
  });

  it('staff read the full name; the client reads first names and the admin by role', () => {
    const lead = { name: 'Divya Rao', email: 'divya@sbc.test', role: 'intern' };
    const admin = { name: 'Ravi Kumar', email: 'ravi@sbc.test', role: 'super_admin' };
    const client = { name: 'Anil Mehta', email: 'anil@acme.test', role: 'client' };
    expect(signedUploaderDisplayName('manager', lead)).toBe('Divya Rao');
    expect(signedUploaderDisplayName('admin', admin)).toBe('Ravi Kumar');
    expect(signedUploaderDisplayName('client', lead)).toBe('Divya');
    expect(signedUploaderDisplayName('client', admin)).toBe('Admin');
    expect(signedUploaderDisplayName('client', client)).toBe('Anil Mehta');
    expect(signedUploaderDisplayName('intern', { name: null, email: 'x@acme.test', role: 'client' })).toBe('x');
    expect(signedUploaderDisplayName('client', null)).toBeNull();
  });
});
