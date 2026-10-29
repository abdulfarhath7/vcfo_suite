import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';
import { devDb } from './dev-test-db';

/** Personal API tokens: developer-only management, hashed storage, and the bearer lookup. */

vi.mock('@/db/client', async () => (await import('./dev-test-db')).mockDbModule);

const t = await import('./dev-tokens');

const ctx = (role: AuthContext['role']): AuthContext => ({ userId: `u-${role}`, email: `${role}@x.in`, name: role, role });
const NOW = new Date('2026-10-30T00:00:00Z');

beforeEach(() => devDb.reset());

describe('dev tokens', () => {
  it.each(['admin', 'manager', 'intern', 'client'] as const)('refuses %s before any query', async (role) => {
    await expect(t.listDevTokensForDev(ctx(role))).rejects.toThrow('not permitted');
    await expect(t.createDevTokenForDev(ctx(role), { name: 'x', days: 30 })).rejects.toThrow('not permitted');
    await expect(t.revokeDevTokenForDev(ctx(role), 'id')).rejects.toThrow('not permitted');
    await expect(t.rotateDevTokenForDev(ctx(role), 'id')).rejects.toThrow('not permitted');
    expect(devDb.calls).toHaveLength(0);
  });

  it('stores only the hash and returns the token once', async () => {
    devDb.results.push([{ id: 'tok1' }], []);
    const out = await t.createDevTokenForDev(ctx('developer'), { name: 'Grafana', days: 30 }, NOW);
    expect(out.token.startsWith(t.TOKEN_PREFIX)).toBe(true);
    expect(out.id).toBe('tok1');
    expect(t.hashToken(out.token)).toMatch(/^[0-9a-f]{64}$/);
    expect(t.hashToken(out.token)).not.toContain(out.token);
  });

  it('lists tokens with their state and never the hash', async () => {
    devDb.results.push([
      { id: 'a', name: 'A', prefix: 'vcfo_dev_Ab', createdAt: NOW, expiresAt: new Date('2026-11-30T00:00:00Z'), lastUsedAt: null, revokedAt: null, by: 'Dev', email: 'd@x.in' },
      { id: 'b', name: 'B', prefix: 'vcfo_dev_Cd', createdAt: NOW, expiresAt: new Date('2026-10-01T00:00:00Z'), lastUsedAt: null, revokedAt: null, by: null, email: 'e@x.in' },
    ]);
    const rows = await t.listDevTokensForDev(ctx('super_admin'), NOW);
    expect(rows.map((r) => r.status)).toEqual(['active', 'expired']);
    expect(rows[1].by).toBe('e');
    expect(JSON.stringify(rows)).not.toMatch(/token_?hash/i);
  });

  it('rotates: a new token, the old one kept for 24 hours', async () => {
    devDb.results.push([{ id: 'old', name: 'A', createdAt: new Date('2026-10-01T00:00:00Z'), expiresAt: new Date('2026-12-30T00:00:00Z') }], [], [{ id: 'new' }], []);
    const out = await t.rotateDevTokenForDev(ctx('developer'), 'old', NOW);
    expect(out?.id).toBe('new');
    expect(devDb.calls.map((c) => c.op)).toEqual(['select', 'update', 'insert', 'insert']);
    devDb.reset();
    devDb.results.push([]);
    expect(await t.rotateDevTokenForDev(ctx('developer'), 'gone', NOW)).toBeNull();
  });

  it('resolves a bearer token only for a live token of an active developer', async () => {
    expect(await t.systemResolveDevToken('not-ours')).toBeNull();
    expect(devDb.calls).toHaveLength(0);

    devDb.results.push([{ id: 'a', userId: 'u1', email: 'd@x.in', name: 'Dev', role: 'developer', status: 'active' }], []);
    expect(await t.systemResolveDevToken(`${t.TOKEN_PREFIX}abc`, NOW)).toEqual({ userId: 'u1', email: 'd@x.in', name: 'Dev', role: 'developer' });

    devDb.results.push([{ id: 'a', userId: 'u2', email: 'm@x.in', name: 'M', role: 'manager', status: 'active' }]);
    expect(await t.systemResolveDevToken(`${t.TOKEN_PREFIX}abc`, NOW)).toBeNull();

    devDb.results.push([{ id: 'a', userId: 'u1', email: 'd@x.in', name: 'Dev', role: 'developer', status: 'inactive' }]);
    expect(await t.systemResolveDevToken(`${t.TOKEN_PREFIX}abc`, NOW)).toBeNull();
  });
});
