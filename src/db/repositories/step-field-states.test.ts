import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import type { AuthContext } from '@/auth/guards';

/**
 * Cross-tenant scoping for step field states (S-496, S-497, S-499):
 *   developer — refused before any query;
 *   client — reads its own engagement only, never writes;
 *   intern / manager — only engagements `assertEngagementAccess` allows;
 *   admin / super_admin — every engagement.
 * A foreign engagement never reaches an insert, update or delete, and writes use the approved id.
 */

type Call = { op: string; where?: SQL; values?: unknown; set?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    limit: () => c,
    returning: () => c,
    onConflictDoUpdate: (o: { set: unknown }) => {
      call.set = o.set;
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
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(results.shift() ?? []).then(res, rej),
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
vi.mock('@/db/repositories/audit-events', () => ({ recordAuditEvent: (...a: unknown[]) => recordAuditEvent(...a) }));
const postStaffMessage = vi.fn();
vi.mock('@/db/repositories/client-messages', () => ({ postStaffMessage: (...a: unknown[]) => postStaffMessage(...a) }));

const repo = await import('@/db/repositories/step-field-states');

const dialect = new PgDialect();
const OWN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02';

function ctx(role: string, userId = `user-${role}`): AuthContext {
  return { userId, email: `${role}@vcfo.local`, name: role, role: role as AuthContext['role'] };
}

function row(state: string, askedAt: Date | null = new Date('2026-10-20T00:00:00Z')) {
  return {
    id: 'r1',
    engagementId: OWN,
    itemId: 'pre-1',
    fieldId: 'companyName',
    state,
    askedAt,
    reviewedAt: null,
    actorId: 'user-intern',
    updatedAt: new Date(),
  };
}

const writes = () => calls.filter((c) => c.op !== 'select');
const act = (action: string, engagementId = OWN) =>
  ({ engagementId, itemId: 'pre-1', fieldId: 'companyName', action }) as Parameters<typeof repo.applyStepFieldAction>[1];

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  results = [];
  assertEngagementAccess.mockImplementation(async (_c: AuthContext, id: string) =>
    id === OWN ? { ok: true, dbId: OWN, row: { id: OWN } } : { ok: false, dbId: id, forbidden: true },
  );
});

describe('who may read field states', () => {
  it('a developer is refused before any query', async () => {
    await expect(repo.listStepFieldStates(ctx('developer'), OWN)).rejects.toMatchObject({ status: 403 });
    expect(assertEngagementAccess).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it.each(['super_admin', 'admin', 'manager', 'intern', 'client'])('%s gets 403 on another engagement and no query', async (role) => {
    await expect(repo.listStepFieldStates(ctx(role), OTHER)).rejects.toMatchObject({ status: 403 });
    expect(calls).toHaveLength(0);
  });

  it.each(['manager', 'client'])('%s reads one step on the approved engagement only', async (role) => {
    results = [[row('asked')]];
    const out = await repo.listStepFieldStates(ctx(role), OWN, 'pre-1');
    expect(out).toEqual([expect.objectContaining({ itemId: 'pre-1', fieldId: 'companyName', state: 'asked' })]);
    const q = dialect.sqlToQuery(calls[0]!.where!);
    expect(q.params).toEqual([OWN, 'pre-1']);
  });
});

describe('writes', () => {
  it.each(['client', 'developer'])('%s cannot write', async (role) => {
    await expect(repo.applyStepFieldAction(ctx(role), act('ask'))).rejects.toMatchObject({ status: 403 });
    expect(calls).toHaveLength(0);
  });

  it.each(['manager', 'intern'])('%s cannot write on another engagement', async (role) => {
    await expect(repo.applyStepFieldAction(ctx(role), act('approve', OTHER))).rejects.toMatchObject({ status: 403 });
    expect(writes()).toHaveLength(0);
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it('refuses an unknown step', async () => {
    await expect(
      repo.applyStepFieldAction(ctx('intern'), { ...act('ask'), itemId: 'not-a-step' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(writes()).toHaveLength(0);
  });

  it('ask upserts on the approved id with asked_at and audits', async () => {
    results = [[], [row('asked')]];
    const out = await repo.applyStepFieldAction(ctx('intern'), act('ask'));
    const w = writes()[0]!;
    expect(w.op).toBe('insert');
    expect(w.values).toMatchObject({ engagementId: OWN, itemId: 'pre-1', fieldId: 'companyName', state: 'asked', actorId: 'user-intern' });
    expect((w.values as { askedAt: unknown }).askedAt).toBeInstanceOf(Date);
    expect(out?.state).toBe('asked');
    expect(recordAuditEvent.mock.calls[0]![1]).toMatchObject({ engagementId: OWN, action: 'step.field_ask' });
  });

  it('approve keeps the ask date and stamps reviewed_at', async () => {
    const asked = new Date('2026-10-20T00:00:00Z');
    results = [[row('answered', asked)], [{ ...row('approved', asked), reviewedAt: new Date() }]];
    await repo.applyStepFieldAction(ctx('manager'), act('approve'));
    const set = writes()[0]!.set as { state: string; askedAt: Date; reviewedAt: Date };
    expect(set.state).toBe('approved');
    expect(set.askedAt).toBe(asked);
    expect(set.reviewedAt).toBeInstanceOf(Date);
  });

  it('remind needs an asked field and posts one step-keyed message', async () => {
    results = [[row('approved')]];
    await expect(repo.applyStepFieldAction(ctx('intern'), act('remind'))).rejects.toMatchObject({ status: 409 });
    expect(postStaffMessage).not.toHaveBeenCalled();

    results = [[row('asked')]];
    await repo.applyStepFieldAction(ctx('intern'), { ...act('remind'), label: 'Company name' });
    expect(postStaffMessage).toHaveBeenCalledTimes(1);
    const msg = postStaffMessage.mock.calls[0]![1] as { engagementId: string; body: string; itemKey: string };
    expect(msg.engagementId).toBe(OWN);
    expect(msg.body).toContain('Company name');
    expect(msg.itemKey).toMatch(/^step:.+:pre-1$/);
    expect(writes()).toHaveLength(0);
  });

  it('clear deletes only the approved engagement’s row', async () => {
    results = [[row('asked')], []];
    const out = await repo.applyStepFieldAction(ctx('admin'), act('clear'));
    expect(out).toBeNull();
    const w = writes()[0]!;
    expect(w.op).toBe('delete');
    expect(dialect.sqlToQuery(w.where!).params).toEqual([OWN, 'pre-1', 'companyName']);
  });
});

const { changedFilledFields } = await import('@/db/repositories/step-field-answers');

describe('asked fields become answered on a client save', () => {
  it('lists only fields that changed to a filled value', () => {
    const prev = { 'pre-1': { responses: { companyName: '', pan: 'ABCDE1234F' } } };
    const next = { 'pre-1': { responses: { companyName: 'Larkspur', pan: 'ABCDE1234F', cin: '' } } };
    expect([...changedFilledFields(prev, next)]).toEqual([['pre-1', ['companyName']]]);
  });
});
