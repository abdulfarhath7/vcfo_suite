import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import type { AuthContext } from '@/auth/guards';

/**
 * Scope for the sales pipeline (G-21): only the super admin reads or writes prospects. Every
 * other role, the firm admin included, is refused before any query runs. "Convert to client"
 * links a won prospect only to an engagement `assertEngagementAccess` approves, and writes the
 * approved database id, never the id the caller sent.
 */

type Call = { op: string; where?: SQL; values?: unknown; set?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    orderBy: () => c,
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
    values: (v: unknown) => {
      call.values = v;
      return c;
    },
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(results.shift() ?? []).then(res, rej),
  };
  return c;
}
function op(name: string) {
  return () => {
    const call: Call = { op: name };
    calls.push(call);
    return chain(call);
  };
}

vi.mock('@/db/client', () => ({
  db: { select: op('select'), insert: op('insert'), update: op('update'), delete: op('delete') },
}));

const assertEngagementAccess = vi.fn();
vi.mock('@/db/repositories/engagements', () => ({
  assertEngagementAccess: (...a: unknown[]) => assertEngagementAccess(...a),
}));
const recordAuditEvent = vi.fn();
vi.mock('@/db/repositories/audit-events', () => ({
  recordAuditEvent: (...a: unknown[]) => recordAuditEvent(...a),
}));

const repo = await import('@/db/repositories/prospects');

const dialect = new PgDialect();
const OWN_DB = '11111111-1111-1111-1111-111111111101';
const OTHER = '22222222-2222-2222-2222-222222222202';

function ctx(role: AuthContext['role']): AuthContext {
  return { userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role };
}

function prospectRow(over: Record<string, unknown> = {}) {
  const now = new Date('2026-10-20T00:00:00Z');
  return {
    id: 'p-1',
    name: 'Asha Rao',
    company: 'Northwind',
    email: null,
    phone: null,
    source: 'referral',
    stage: 'proposal',
    service: 'incorporation',
    ownerId: null,
    notes: null,
    nextStepOn: null,
    closedAt: null,
    engagementId: null,
    createdBy: 'user-super_admin',
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

const NOT_SUPER = ['admin', 'manager', 'intern', 'client', 'developer'] as const;

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  results = [];
});

describe('reads', () => {
  it('super admin lists every prospect', async () => {
    results = [[prospectRow(), prospectRow({ id: 'p-2' })]];
    const rows = await repo.listProspects(ctx('super_admin'));
    expect(rows.map((r) => r.id)).toEqual(['p-1', 'p-2']);
    expect(calls[0]!.where).toBeUndefined();
  });

  it.each(NOT_SUPER)('%s is refused before any query', async (role) => {
    await expect(repo.listProspects(ctx(role))).rejects.toThrow(/super admin/);
    await expect(repo.getProspect(ctx(role), 'p-1')).rejects.toThrow(/super admin/);
    await expect(repo.listProspectOwners(ctx(role))).rejects.toThrow(/super admin/);
    expect(calls).toHaveLength(0);
  });
});

describe('writes', () => {
  it.each(NOT_SUPER)('%s cannot create, edit, convert or add from a demo request', async (role) => {
    await expect(repo.createProspect(ctx(role), { name: 'X' })).rejects.toThrow(/super admin/);
    await expect(repo.updateProspect(ctx(role), 'p-1', { stage: 'won' })).rejects.toThrow(/super admin/);
    await expect(repo.convertProspect(ctx(role), 'p-1', OWN_DB)).rejects.toThrow(/super admin/);
    await expect(repo.createProspectFromDemoRequest(ctx(role), 'd-1')).rejects.toThrow(/super admin/);
    expect(calls).toHaveLength(0);
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it('stamps closed_at when a prospect is won, and audits the move', async () => {
    results = [[prospectRow()], [prospectRow({ stage: 'won', closedAt: new Date() })]];
    const out = await repo.updateProspect(ctx('super_admin'), 'p-1', { stage: 'won' });
    expect(out?.stage).toBe('won');
    const update = calls.find((c) => c.op === 'update')!;
    expect((update.set as { closedAt: Date | null }).closedAt).toBeInstanceOf(Date);
    expect(recordAuditEvent).toHaveBeenCalledWith(
      ctx('super_admin'),
      expect.objectContaining({ action: 'prospect.stage' }),
    );
  });

  it('refuses an owner who is not staff', async () => {
    results = [[]];
    await expect(repo.createProspect(ctx('super_admin'), { name: 'X', ownerId: OTHER })).rejects.toThrow('invalid_owner');
    expect(calls.some((c) => c.op === 'insert')).toBe(false);
  });
});

describe('convertProspect', () => {
  it('links to the approved database id', async () => {
    results = [[prospectRow({ stage: 'won' })], [prospectRow({ stage: 'won', engagementId: OWN_DB })]];
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN_DB, row: { companyName: 'Northwind' } });
    const out = await repo.convertProspect(ctx('super_admin'), 'p-1', 'e1');
    expect(out?.engagementId).toBe(OWN_DB);
    expect(assertEngagementAccess).toHaveBeenCalledWith(ctx('super_admin'), 'e1');
    const update = calls.find((c) => c.op === 'update')!;
    expect(update.set).toMatchObject({ engagementId: OWN_DB });
  });

  it('makes no write for an engagement the caller cannot see', async () => {
    results = [[prospectRow({ stage: 'won' })]];
    assertEngagementAccess.mockResolvedValue({ ok: false, dbId: OTHER, notFound: true });
    await expect(repo.convertProspect(ctx('super_admin'), 'p-1', OTHER)).rejects.toThrow('engagement_not_found');
    expect(calls.some((c) => c.op === 'update')).toBe(false);
  });

  it('refuses a prospect that is not won', async () => {
    results = [[prospectRow({ stage: 'proposal' })]];
    await expect(repo.convertProspect(ctx('super_admin'), 'p-1', OWN_DB)).rejects.toThrow('not_won');
    expect(assertEngagementAccess).not.toHaveBeenCalled();
  });
});

describe('createProspectFromDemoRequest', () => {
  it('creates a demo_request lead and marks the request', async () => {
    const request = {
      id: 'd-1',
      name: 'Asha',
      email: 'asha@firm.in',
      company: 'Northwind',
      phone: null,
      message: 'Hello',
      prospectId: null,
      createdAt: new Date(),
    };
    results = [
      [request], // getDemoRequest
      [{ id: 'user-super_admin' }], // assertOwner
      [prospectRow({ id: 'p-9', source: 'demo_request', stage: 'lead' })], // insert
      [{ id: 'user-super_admin', name: 'Mithilesh', email: 'm@x.in' }], // owner names
      [], // mark request
    ];
    const out = await repo.createProspectFromDemoRequest(ctx('super_admin'), 'd-1');
    expect(out?.id).toBe('p-9');
    const insert = calls.find((c) => c.op === 'insert')!;
    expect(insert.values).toMatchObject({ source: 'demo_request', stage: 'lead', email: 'asha@firm.in' });
    const mark = calls.filter((c) => c.op === 'update').at(-1)!;
    expect(mark.set).toEqual({ prospectId: 'p-9' });
    const q = dialect.sqlToQuery(mark.where!);
    expect(q.params).toEqual(['d-1']);
  });

  it('refuses a request that was already added', async () => {
    results = [[{ id: 'd-1', name: 'A', email: 'a@b.co', prospectId: 'p-1', createdAt: new Date() }]];
    await expect(repo.createProspectFromDemoRequest(ctx('super_admin'), 'd-1')).rejects.toThrow('already_added');
    expect(calls.some((c) => c.op === 'insert')).toBe(false);
  });
});
