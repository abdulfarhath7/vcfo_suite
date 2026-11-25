import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Demo logins (PLAN H2, src/lib/demo-logins.ts): a demo session must run inside the demo scope
 * (src/db/demo-scope.ts) and its profile must be a demo row. Every role is admitted there, the
 * context is flagged `demo: true`, and `noDemo` refuses it on blocked routes. A mismatch either
 * way (demo session outside the scope, real session reading a demo row, demo session reading a
 * real row) gets no context.
 */
let sessionUser: Record<string, unknown> | undefined;
vi.mock('./config', () => ({ auth: async () => (sessionUser ? { user: sessionUser } : null) }));

let profileRow: Record<string, unknown> | undefined;
const chain = {
  select: () => chain,
  from: () => chain,
  where: () => chain,
  limit: () => Promise.resolve(profileRow ? [profileRow] : []),
};
vi.mock('@/db/client', () => ({ db: { select: () => chain.select() } }));
vi.mock('@/db/repositories/user-sessions', () => ({
  systemIsSessionActive: async () => true,
  systemTouchLastSeen: async () => undefined,
}));

const { requireAuth, requireAdmin, requireAdminOrManager, requireAnyRole, requireDeveloper, requireOwnAccount, clearGuardLookups } = await import('./guards');
const { noDemo } = await import('@/lib/demo-logins');
const { runInDemo } = await import('@/db/demo-scope');

const ME = '11111111-1111-4111-8111-111111111111';
const row = (role: string, isDemo: boolean) => ({ id: ME, email: `${role}@vcfosuite.com`, name: 'Demo', role, internId: role === 'intern' ? 'demo-lead' : null, clientId: role === 'client' ? 'demo-client' : null, status: 'active', isDemo });

beforeEach(() => {
  clearGuardLookups();
  sessionUser = { id: ME, email: 'x@vcfosuite.com', role: 'intern' };
});

const demoSession = () => {
  sessionUser = { id: ME, email: 'x@vcfosuite.com', role: 'intern', demo: true };
};

describe('demo profiles in the guard', () => {
  it.each(['admin', 'super_admin', 'manager', 'intern', 'client'])('a demo %s inside the demo scope is admitted and flagged demo', async (role) => {
    demoSession();
    profileRow = row(role, true);
    const g = await runInDemo(() => requireAuth());
    expect(g.ok).toBe(true);
    if (g.ok) expect(g.ctx.demo).toBe(true);
    expect(noDemo(g)).toEqual({ ok: false, status: 403, error: 'Not available on demo logins' });
  });

  it('a demo admin passes the admin guards inside the demo scope', async () => {
    demoSession();
    profileRow = row('admin', true);
    expect((await runInDemo(() => requireAdmin())).ok).toBe(true);
    expect((await runInDemo(() => requireAdminOrManager())).ok).toBe(true);
  });

  it('a demo session outside the demo scope gets no context (fail closed)', async () => {
    demoSession();
    profileRow = row('intern', true);
    expect(await requireAuth()).toMatchObject({ ok: false, status: 401 });
    expect(await requireOwnAccount()).toMatchObject({ ok: false, status: 401 });
  });

  it('a demo session whose row is not a demo row gets no context', async () => {
    demoSession();
    profileRow = row('admin', false);
    expect(await runInDemo(() => requireAdmin())).toMatchObject({ ok: false, status: 401 });
  });

  it('a real session that finds a demo row gets no context', async () => {
    profileRow = row('intern', true);
    expect(await requireAuth()).toMatchObject({ ok: false, status: 401 });
    expect(await requireAnyRole('intern', 'client')).toMatchObject({ ok: false, status: 401 });
  });

  it('a real session inside a demo scope gets no context', async () => {
    profileRow = row('admin', false);
    expect(await runInDemo(() => requireAdmin())).toMatchObject({ ok: false, status: 401 });
  });

  it('a demo developer still gets no developer console outside the demo scope', async () => {
    demoSession();
    profileRow = row('developer', true);
    expect(await requireDeveloper()).toMatchObject({ ok: false, status: 401 });
  });

  it('demo logins switched off: a demo session gets no context', async () => {
    demoSession();
    profileRow = row('intern', true);
    const prev = process.env.DEMO_DB_NAME;
    process.env.DEMO_DB_NAME = 'off';
    try {
      expect(await runInDemo(() => requireAuth())).toMatchObject({ ok: false, status: 401 });
    } finally {
      if (prev === undefined) delete process.env.DEMO_DB_NAME;
      else process.env.DEMO_DB_NAME = prev;
    }
  });

  it('a real person is not flagged and passes noDemo', async () => {
    profileRow = row('admin', false);
    const g = await requireAdmin();
    expect(g.ok).toBe(true);
    if (g.ok) expect(g.ctx.demo).toBeUndefined();
    expect(noDemo(g)).toBe(g);
  });
});
