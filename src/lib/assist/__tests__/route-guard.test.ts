import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAuth = vi.fn();
vi.mock('@/auth/guards', () => ({ requireAuth: () => requireAuth() }));

const { requireAssist } = await import('@/lib/assist/route-guard');

function as(role: string) {
  requireAuth.mockResolvedValue({ ok: true, ctx: { userId: 'u', email: 'e', name: 'n', role } });
}

beforeEach(() => {
  process.env.ASSIST_ENABLED = 'true';
});

describe('requireAssist', () => {
  it.each(['manager', 'intern'])('returns 403 for %s', async (role) => {
    as(role);
    const gate = await requireAssist();
    expect(gate.ok).toBe(false);
    if (gate.ok === false) expect(gate.response.status).toBe(403);
  });

  it.each(['client', 'admin', 'super_admin'])('lets %s through', async (role) => {
    as(role);
    expect((await requireAssist()).ok).toBe(true);
  });

  it('returns 404 while the feature flag is off', async () => {
    process.env.ASSIST_ENABLED = 'false';
    as('client');
    const gate = await requireAssist();
    if (gate.ok === false) expect(gate.response.status).toBe(404);
    else throw new Error('expected 404');
  });
});
