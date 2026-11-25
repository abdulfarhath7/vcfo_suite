import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Demo logins (src/lib/demo-logins.ts): the guard admits a demo profile only as a lead or a
 * client, marks the context `demo: true`, and `noDemo` refuses it on blocked routes. A demo
 * admin, manager or developer never gets a context, so no firm-wide repository runs for one.
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

const ME = '11111111-1111-4111-8111-111111111111';
const row = (role: string, isDemo: boolean) => ({ id: ME, email: `${role}@vcfosuite.com`, name: 'Demo', role, internId: role === 'intern' ? 'demo-lead' : null, clientId: role === 'client' ? 'demo-client' : null, status: 'active', isDemo });

beforeEach(() => {
  clearGuardLookups();
  sessionUser = { id: ME, email: 'x@vcfosuite.com', role: 'intern' };
});

describe('demo profiles in the guard', () => {
  it.each(['admin', 'super_admin', 'manager'])('a demo %s gets no context from any guard', async (role) => {
    profileRow = row(role, true);
    expect(await requireAuth()).toMatchObject({ ok: false, status: 401 });
    expect(await requireAdmin()).toMatchObject({ ok: false, status: 401 });
    expect(await requireAdminOrManager()).toMatchObject({ ok: false, status: 401 });
    expect(await requireAnyRole('super_admin', 'admin', 'manager', 'intern', 'client')).toMatchObject({ ok: false, status: 401 });
    expect(await requireOwnAccount()).toMatchObject({ ok: false, status: 401 });
  });

  it('a demo developer gets no developer console', async () => {
    profileRow = row('developer', true);
    expect(await requireDeveloper()).toMatchObject({ ok: false, status: 401 });
  });

  it.each(['intern', 'client'])('a demo %s is admitted and flagged demo', async (role) => {
    profileRow = row(role, true);
    const g = await requireAuth();
    expect(g.ok).toBe(true);
    if (g.ok) expect(g.ctx.demo).toBe(true);
    expect(noDemo(g)).toEqual({ ok: false, status: 403, error: 'Not available on demo logins' });
  });

  it('a real person is not flagged and passes noDemo', async () => {
    profileRow = row('admin', false);
    const g = await requireAdmin();
    expect(g.ok).toBe(true);
    if (g.ok) expect(g.ctx.demo).toBeUndefined();
    expect(noDemo(g)).toBe(g);
  });
});
