import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import type { AuthContext } from '@/auth/guards';

/**
 * Mail groups (G-23): a staff member sees their own groups and the shared ones, never another
 * person's private group. Only firm-wide admins create or share a shared group. Clients and
 * developers are refused before any query. A group the caller cannot see expands to nothing.
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
const recordAuditEvent = vi.fn();
vi.mock('@/db/repositories/audit-events', () => ({
  recordAuditEvent: (...a: unknown[]) => recordAuditEvent(...a),
}));

const repo = await import('@/db/repositories/mail-groups');

const dialect = new PgDialect();
const GROUP = '33333333-3333-3333-3333-333333333303';

function ctx(role: AuthContext['role'], userId = `user-${role}`): AuthContext {
  return { userId, email: `${role}@vcfo.local`, name: role, role };
}

function groupRow(ownerId: string, shared = false, id = GROUP) {
  return { id, name: 'Auditors', shared, ownerId, createdAt: new Date() };
}

const writes = () => calls.filter((c) => c.op !== 'select');

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  results = [];
});

describe('listMailGroups', () => {
  it.each(['super_admin', 'admin', 'manager', 'intern'] as const)(
    '%s reads only its own groups and shared ones',
    async (role) => {
      results = [[groupRow(`user-${role}`)], [{ groupId: GROUP, email: 'a@x.in', name: null, position: 0 }]];
      const groups = await repo.listMailGroups(ctx(role));
      expect(groups).toHaveLength(1);
      expect(groups[0]!.members).toEqual([{ email: 'a@x.in', name: null }]);
      const q = dialect.sqlToQuery(calls[0]!.where!);
      expect(q.sql).toContain('"mail_groups"."owner_id" = $1');
      expect(q.sql).toContain('"mail_groups"."shared" = $2');
      expect(q.params).toEqual([`user-${role}`, true]);
    },
  );

  it.each(['client', 'developer'] as const)('%s is refused before any query', async (role) => {
    await expect(repo.listMailGroups(ctx(role))).rejects.toThrow('not permitted');
    expect(calls).toHaveLength(0);
  });

  it('marks a shared group editable for an admin but not for a manager', async () => {
    results = [[groupRow('someone-else', true)], []];
    expect((await repo.listMailGroups(ctx('admin')))[0]!.canEdit).toBe(true);
    results = [[groupRow('someone-else', true)], []];
    expect((await repo.listMailGroups(ctx('manager')))[0]!.canEdit).toBe(false);
  });
});

describe('createMailGroup', () => {
  const input = { name: ' Auditors ', members: [{ email: 'A@X.in', name: 'A' }, { email: 'a@x.in', name: null }] };

  it.each(['manager', 'intern'] as const)('%s may not create a shared group', async (role) => {
    await expect(repo.createMailGroup(ctx(role), { ...input, shared: true })).rejects.toThrow(
      'Only admins may create a shared group',
    );
    expect(calls).toHaveLength(0);
  });

  it.each(['admin', 'super_admin'] as const)('%s may create a shared group', async (role) => {
    results = [[groupRow(`user-${role}`, true)], [], [], []];
    const dto = await repo.createMailGroup(ctx(role), { ...input, shared: true });
    expect(dto.shared).toBe(true);
    const insert = calls.find((c) => c.op === 'insert')!;
    expect(insert.values).toEqual({ name: 'Auditors', shared: true, ownerId: `user-${role}` });
    expect(recordAuditEvent).toHaveBeenCalledOnce();
  });

  it('owns the group as the caller and de-duplicates addresses', async () => {
    results = [[groupRow('user-intern')], [], [], []];
    await repo.createMailGroup(ctx('intern'), input);
    const inserts = calls.filter((c) => c.op === 'insert');
    expect(inserts[0]!.values).toEqual({ name: 'Auditors', shared: false, ownerId: 'user-intern' });
    expect(inserts[1]!.values).toEqual([{ groupId: GROUP, email: 'a@x.in', name: 'A', position: 0 }]);
  });

  it('refuses a bad address', async () => {
    await expect(
      repo.createMailGroup(ctx('admin'), { name: 'X', members: [{ email: 'nope', name: null }] }),
    ).rejects.toThrow('invalid_email');
    expect(calls).toHaveLength(0);
  });
});

describe('updateMailGroup and deleteMailGroup', () => {
  it('reads as not found when the group is neither own nor shared', async () => {
    results = [[]];
    await expect(repo.updateMailGroup(ctx('manager'), GROUP, { name: 'Y' })).rejects.toThrow('not_found');
    const q = dialect.sqlToQuery(calls[0]!.where!);
    expect(q.params).toEqual([GROUP, 'user-manager', true]);
    expect(writes()).toHaveLength(0);
  });

  it('refuses a manager changing a shared group they do not own', async () => {
    results = [[groupRow('user-admin', true)]];
    await expect(repo.deleteMailGroup(ctx('manager'), GROUP)).rejects.toThrow('not permitted');
    expect(writes()).toHaveLength(0);
  });

  it('refuses a manager sharing their own group', async () => {
    results = [[groupRow('user-manager')]];
    await expect(repo.updateMailGroup(ctx('manager'), GROUP, { shared: true })).rejects.toThrow(
      'Only admins may share a group',
    );
    expect(writes()).toHaveLength(0);
  });

  it('lets the owner delete their group', async () => {
    results = [[groupRow('user-intern')], []];
    await repo.deleteMailGroup(ctx('intern'), GROUP);
    expect(writes().map((c) => c.op)).toEqual(['delete']);
    expect(recordAuditEvent).toHaveBeenCalledOnce();
  });
});

describe('expandMailGroups', () => {
  it('expands only groups the caller can see', async () => {
    results = [[]];
    expect(await repo.expandMailGroups(ctx('intern'), [GROUP])).toEqual([]);
    const q = dialect.sqlToQuery(calls[0]!.where!);
    expect(q.params).toEqual([GROUP, 'user-intern', true]);
    expect(calls).toHaveLength(1);
  });

  it('returns unique lowercased addresses in order', async () => {
    results = [[{ id: GROUP }], [{ email: 'B@x.in' }, { email: 'a@x.in' }, { email: 'b@x.in' }]];
    expect(await repo.expandMailGroups(ctx('manager'), [GROUP])).toEqual(['b@x.in', 'a@x.in']);
  });

  it('refuses a client', async () => {
    await expect(repo.expandMailGroups(ctx('client'), [GROUP])).rejects.toThrow('not permitted');
    expect(calls).toHaveLength(0);
  });
});
