import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';

/**
 * Integrations hub access (docs/specs/integrations/ZOHO.md): the firm connection, its orgs,
 * links and jobs are firm-wide admin only; a module's read of a client's mapped org needs
 * engagement access; clients are refused before any query. Also: the token refresh on demand.
 */

vi.mock('server-only', () => ({}));

type Call = { op: string; set?: unknown; values?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    innerJoin: () => c,
    orderBy: () => c,
    limit: () => c,
    returning: () => c,
    onConflictDoNothing: () => c,
    where: () => c,
    set: (s: unknown) => {
      call.set = s;
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
const dbStub = { select: op('select'), insert: op('insert'), update: op('update'), delete: op('delete'), transaction: async (fn: (tx: unknown) => unknown) => fn(dbStub) };
vi.mock('@/db/client', () => ({ db: dbStub }));

const assertEngagementAccess = vi.fn();
vi.mock('@/db/repositories/engagements', () => ({ assertEngagementAccess: (...a: unknown[]) => assertEngagementAccess(...a) }));
vi.mock('@/db/repositories/audit-events', () => ({ recordAuditEvent: vi.fn(async () => undefined) }));

const refreshZohoToken = vi.fn();
const revokeZohoToken = vi.fn(async () => ({ ok: true }));
vi.mock('@/lib/integrations/zoho/oauth', () => ({
  refreshZohoToken: (...a: unknown[]) => refreshZohoToken(...a),
  revokeZohoToken: (...a: unknown[]) => revokeZohoToken(...(a as [])),
}));

process.env.AUTH_SECRET = 'repo-test-secret';
const repo = await import('./index');
const { encryptSecret, decryptSecret } = await import('@/lib/integrations/token-crypto');

function ctx(role: AuthContext['role']): AuthContext {
  return { userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role };
}

beforeEach(() => {
  calls.length = 0;
  results = [];
  assertEngagementAccess.mockReset();
  refreshZohoToken.mockReset();
});

const NON_ADMINS: AuthContext['role'][] = ['manager', 'intern', 'client', 'developer', 'partner'];

describe('firm connection access', () => {
  for (const role of NON_ADMINS) {
    it(`refuses ${role} before any query`, async () => {
      await expect(repo.getFirmConnection(ctx(role))).rejects.toThrow('not permitted');
      await expect(repo.listFirmLinks(ctx(role))).rejects.toThrow('not permitted');
      await expect(repo.listFirmOrgs(ctx(role))).rejects.toThrow('not permitted');
      await expect(repo.listMapTargetOptions(ctx(role))).rejects.toThrow('not permitted');
      await expect(repo.decideLink(ctx(role), 'l1', { action: 'ignore' })).rejects.toThrow('not permitted');
      await expect(repo.acceptAllSuggested(ctx(role))).rejects.toThrow('not permitted');
      await expect(repo.disconnectFirmConnection(ctx(role))).rejects.toThrow('not permitted');
      await expect(
        repo.saveFirmConnection(ctx(role), { accountsServer: 'https://accounts.zoho.in', apiDomain: 'https://www.zohoapis.in', location: 'in', accessToken: 'a', refreshToken: 'r', expiresInSec: 3600, scopes: null }),
      ).rejects.toThrow('not permitted');
      expect(calls).toHaveLength(0);
    });
  }

  for (const role of ['super_admin', 'admin'] as const) {
    it(`lets ${role} read the firm connection`, async () => {
      results = [[{ id: 'c1', provider: 'zoho' }]];
      await expect(repo.getFirmConnection(ctx(role))).resolves.toMatchObject({ id: 'c1' });
    });
  }

  it('saves tokens sealed, never in plain text', async () => {
    results = [[], [{ id: 'new' }]];
    await repo.saveFirmConnection(ctx('admin'), { accountsServer: 'https://accounts.zoho.in', apiDomain: 'https://www.zohoapis.in', location: 'in', accessToken: 'plain-access', refreshToken: 'plain-refresh', expiresInSec: 3600, scopes: 'ZohoBooks.invoices.READ' });
    const insert = calls.find((c) => c.op === 'insert')!;
    const v = insert.values as Record<string, string>;
    expect(JSON.stringify(v)).not.toContain('plain-');
    expect(decryptSecret(v.refreshTokenEnc!)).toBe('plain-refresh');
    expect(v).toMatchObject({ scope: 'firm', accountsServer: 'https://accounts.zoho.in', apiDomain: 'https://www.zohoapis.in', location: 'in' });
    // The older live connection is retired first.
    expect(calls[0]).toMatchObject({ op: 'update' });
  });

  it('a decision on a link of another connection reads as not found', async () => {
    results = [[{ id: 'c1' }], []];
    await expect(repo.decideLink(ctx('admin'), 'foreign', { action: 'ignore' })).resolves.toBeNull();
    expect(calls.some((c) => c.op === 'update')).toBe(false);
  });

  it('disconnect revokes at Zoho, then retires the row', async () => {
    results = [[{ id: 'c1', refreshTokenEnc: encryptSecret('r1'), accountsServer: 'https://accounts.zoho.in' }]];
    await expect(repo.disconnectFirmConnection(ctx('super_admin'))).resolves.toEqual({ revokedAtZoho: true });
    expect(revokeZohoToken).toHaveBeenCalledWith('r1', 'https://accounts.zoho.in');
    expect(calls.find((c) => c.op === 'update')?.set).toMatchObject({ status: 'revoked', accessTokenEnc: null });
  });
});

describe('mapped org for a client', () => {
  it('refuses clients before any query', async () => {
    await expect(repo.mappedOrgForEngagement(ctx('client'), 'e1', 'payroll')).rejects.toThrow('not permitted');
    expect(assertEngagementAccess).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it('returns null for staff without engagement access, without reading links', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: false, dbId: 'e1', forbidden: true });
    await expect(repo.mappedOrgForEngagement(ctx('manager'), 'e1', 'payroll')).resolves.toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('returns the mapped org for staff with access', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: 'e1', row: {} });
    results = [[{ connectionId: 'c1', externalId: 'org9', name: 'Bonterra' }]];
    await expect(repo.mappedOrgForEngagement(ctx('intern'), 'e1', 'payroll')).resolves.toEqual({ connectionId: 'c1', externalOrgId: 'org9', name: 'Bonterra' });
  });
});

describe('token refresh on demand', () => {
  const future = () => new Date(Date.now() + 30 * 60_000);
  it('uses the stored access token while it is fresh', async () => {
    results = [[{ id: 'c1', accessTokenEnc: encryptSecret('live'), refreshTokenEnc: encryptSecret('r'), expiresAt: future(), accountsServer: 'https://accounts.zoho.in' }]];
    await expect(repo.systemAccessToken('c1')).resolves.toBe('live');
    expect(refreshZohoToken).not.toHaveBeenCalled();
  });

  it('refreshes near expiry and re-seals both tokens', async () => {
    results = [[{ id: 'c1', accessTokenEnc: encryptSecret('old'), refreshTokenEnc: encryptSecret('r'), expiresAt: new Date(Date.now() + 30_000), accountsServer: 'https://accounts.zoho.in' }]];
    refreshZohoToken.mockResolvedValue({ access_token: 'new', expires_in: 3600 });
    await expect(repo.systemAccessToken('c1')).resolves.toBe('new');
    expect(refreshZohoToken).toHaveBeenCalledWith('r', 'https://accounts.zoho.in', undefined);
    const set = calls.find((c) => c.op === 'update')!.set as Record<string, unknown>;
    expect(decryptSecret(set.accessTokenEnc as string)).toBe('new');
    expect(decryptSecret(set.refreshTokenEnc as string)).toBe('r');
    expect(set.status).toBe('active');
  });

  it('refreshes when forced even if fresh', async () => {
    results = [[{ id: 'c1', accessTokenEnc: encryptSecret('live'), refreshTokenEnc: encryptSecret('r'), expiresAt: future(), accountsServer: 'https://accounts.zoho.in' }]];
    refreshZohoToken.mockResolvedValue({ access_token: 'forced' });
    await expect(repo.systemAccessToken('c1', true)).resolves.toBe('forced');
  });

  it('marks the connection in error when Zoho refuses the refresh token', async () => {
    results = [[{ id: 'c1', accessTokenEnc: null, refreshTokenEnc: encryptSecret('r'), expiresAt: null, accountsServer: 'https://accounts.zoho.in' }]];
    refreshZohoToken.mockRejectedValue(Object.assign(new Error('invalid_code'), { code: 'invalid_code' }));
    await expect(repo.systemAccessToken('c1')).rejects.toThrow('invalid_code');
    expect(calls.find((c) => c.op === 'update')?.set).toMatchObject({ status: 'error' });
  });

  it('refuses a revoked connection', async () => {
    results = [[{ id: 'c1', revokedAt: new Date() }]];
    await expect(repo.systemAccessToken('c1')).rejects.toThrow('zoho_not_connected');
  });
});
