import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import type { AuthContext } from '@/auth/guards';

/**
 * Cross-tenant scoping for staff notes on a client record (G-19):
 *   client, developer — refused before any query;
 *   intern / manager — only engagements `assertEngagementAccess` allows;
 *   admin / super_admin — every engagement.
 * Edit is the author's alone; delete is the author's or a firm-wide admin's, and soft.
 * A foreign engagement never reaches an insert, update or delete, and an audit summary
 * never quotes the note.
 */

type Call = { op: string; where?: SQL; values?: unknown; set?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    leftJoin: () => c,
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

const repo = await import('@/db/repositories/engagement-notes');

const dialect = new PgDialect();
const OWN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02';

function ctx(role: string, userId = `user-${role}`): AuthContext {
  return { userId, email: `${role}@vcfo.local`, name: role, role: role as AuthContext['role'] };
}

function note(authorId: string, body = 'Client prefers calls after 4 pm') {
  return { id: 'note-1', engagementId: OWN, body, pinned: false, authorId, authorName: 'Asha', createdAt: new Date(), updatedAt: new Date() };
}

const writes = () => calls.filter((c) => c.op !== 'select');

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  results = [];
  assertEngagementAccess.mockImplementation(async (_c: AuthContext, id: string) =>
    id === OWN ? { ok: true, dbId: OWN, row: { id: OWN } } : { ok: false, dbId: id, forbidden: true },
  );
});

describe('who may read notes', () => {
  it.each(['client', 'developer'])('%s is refused before any query', async (role) => {
    await expect(repo.listEngagementNotes(ctx(role), OWN)).rejects.toMatchObject({ status: 403 });
    await expect(repo.createEngagementNote(ctx(role), OWN, { body: 'x' })).rejects.toMatchObject({ status: 403 });
    expect(assertEngagementAccess).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it.each(['super_admin', 'admin', 'manager', 'intern'])('%s gets 403 on another firm’s engagement and no query', async (role) => {
    await expect(repo.listEngagementNotes(ctx(role), OTHER)).rejects.toMatchObject({ status: 403 });
    expect(calls).toHaveLength(0);
  });

  it.each(['super_admin', 'admin', 'manager', 'intern'])('%s lists live notes on the approved engagement only', async (role) => {
    results = [[note('user-x')]];
    const out = await repo.listEngagementNotes(ctx(role), OWN);
    expect(out).toHaveLength(1);
    const q = dialect.sqlToQuery(calls[0]!.where!);
    expect(q.sql).toContain('"engagement_notes"."deleted_at" is null');
    expect(q.params).toEqual([OWN]);
  });
});

describe('writes', () => {
  it.each(['manager', 'intern'])('%s cannot add a note to another firm’s engagement', async (role) => {
    await expect(repo.createEngagementNote(ctx(role), OTHER, { body: 'hello' })).rejects.toMatchObject({ status: 403 });
    expect(writes()).toHaveLength(0);
  });

  it('adds a note on the approved id, and the audit summary does not quote it', async () => {
    results = [[note('user-intern', 'Secret plan')]];
    const out = await repo.createEngagementNote(ctx('intern'), OWN, { body: '  Secret plan  ' });
    expect(calls[0]!.values).toMatchObject({ engagementId: OWN, authorId: 'user-intern', body: 'Secret plan' });
    expect(out.mine).toBe(true);
    const audit = recordAuditEvent.mock.calls[0]![1] as { summary: string; action: string };
    expect(audit.action).toBe('notes.created');
    expect(audit.summary).not.toContain('Secret');
  });

  it('refuses an empty note', async () => {
    await expect(repo.createEngagementNote(ctx('manager'), OWN, { body: '   ' })).rejects.toMatchObject({ status: 400 });
    expect(writes()).toHaveLength(0);
  });

  it('only the author edits the text', async () => {
    results = [[note('user-someone-else')]];
    await expect(repo.updateEngagementNote(ctx('admin'), OWN, 'note-1', { body: 'changed' })).rejects.toMatchObject({ status: 403 });
    expect(writes()).toHaveLength(0);
  });

  it('anyone with access pins a note', async () => {
    results = [[note('user-someone-else')], []];
    const out = await repo.updateEngagementNote(ctx('manager'), OWN, 'note-1', { pinned: true });
    expect(out.pinned).toBe(true);
    expect(writes()[0]!.set).toMatchObject({ pinned: true });
    expect(recordAuditEvent.mock.calls[0]![1]).toMatchObject({ action: 'notes.pinned' });
  });

  it('a note on another engagement reads as not found, even with the right note id', async () => {
    results = [[]];
    await expect(repo.updateEngagementNote(ctx('manager'), OWN, 'note-elsewhere', { pinned: true })).rejects.toMatchObject({ status: 404 });
    const q = dialect.sqlToQuery(calls[0]!.where!);
    expect(q.params).toContain(OWN);
    expect(writes()).toHaveLength(0);
  });

  it('a manager cannot delete someone else’s note', async () => {
    results = [[note('user-intern')]];
    await expect(repo.deleteEngagementNote(ctx('manager'), OWN, 'note-1')).rejects.toMatchObject({ status: 403 });
    expect(writes()).toHaveLength(0);
  });

  it.each(['admin', 'super_admin'])('%s deletes any note, softly', async (role) => {
    results = [[note('user-intern')], []];
    await repo.deleteEngagementNote(ctx(role), OWN, 'note-1');
    const w = writes();
    expect(w).toHaveLength(1);
    expect(w[0]!.op).toBe('update');
    expect(w[0]!.set).toHaveProperty('deletedAt');
  });

  it('the author deletes their own note', async () => {
    results = [[note('user-intern')], []];
    await repo.deleteEngagementNote(ctx('intern'), OWN, 'note-1');
    expect(writes()[0]!.op).toBe('update');
  });

  it('a list row says who may edit and delete', async () => {
    results = [[note('user-manager'), { ...note('user-intern'), id: 'note-2' }]];
    const [mine, theirs] = await repo.listEngagementNotes(ctx('manager'), OWN);
    expect(mine).toMatchObject({ mine: true, canDelete: true });
    expect(theirs).toMatchObject({ mine: false, canDelete: false });
    const [, adminView] = await (async () => {
      results = [[note('user-manager'), { ...note('user-intern'), id: 'note-2' }]];
      return repo.listEngagementNotes(ctx('admin'), OWN);
    })();
    expect(adminView).toMatchObject({ mine: false, canDelete: true });
  });
});
