import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthContext } from '@/auth/guards';

/**
 * Scope for demo requests (G-30): the public insert takes no AuthContext and only inserts;
 * every read and every other write needs the super admin and is refused before any query.
 */

type Call = { op: string; values?: unknown; set?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    orderBy: () => c,
    limit: () => c,
    returning: () => c,
    where: () => c,
    set: (s: unknown) => {
      call.set = s;
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

const repo = await import('@/db/repositories/demo-requests');

function ctx(role: AuthContext['role']): AuthContext {
  return { userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role };
}

const NOT_SUPER = ['admin', 'manager', 'intern', 'client', 'developer'] as const;

beforeEach(() => {
  calls.length = 0;
  results = [];
});

describe('insertPublicDemoRequest', () => {
  it('inserts the form fields only, and reads nothing', async () => {
    results = [[{ id: 'd-1' }]];
    const out = await repo.insertPublicDemoRequest({
      name: 'Asha',
      email: 'asha@firm.in',
      company: 'Northwind',
      phone: null,
      message: null,
    });
    expect(out).toEqual({ id: 'd-1' });
    expect(calls.map((c) => c.op)).toEqual(['insert']);
    expect(calls[0]!.values).toEqual({ name: 'Asha', email: 'asha@firm.in', company: 'Northwind', phone: null, message: null });
  });
});

describe('super admin reads', () => {
  it('lists requests for the super admin', async () => {
    results = [[{ id: 'd-1', name: 'A', email: 'a@b.co', company: null, phone: null, message: null, prospectId: null, createdAt: new Date() }]];
    expect(await repo.listDemoRequests(ctx('super_admin'))).toHaveLength(1);
  });

  it.each(NOT_SUPER)('%s is refused before any query', async (role) => {
    await expect(repo.listDemoRequests(ctx(role))).rejects.toThrow(/super admin/);
    await expect(repo.getDemoRequest(ctx(role), 'd-1')).rejects.toThrow(/super admin/);
    await expect(repo.markDemoRequestProspect(ctx(role), 'd-1', 'p-1')).rejects.toThrow(/super admin/);
    expect(calls).toHaveLength(0);
  });
});
