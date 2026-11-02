import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * M7: `systemReencryptTotpSecrets` moves `t1` (AUTH_SECRET) values to `t2`
 * (CREDENTIALS_ENCRYPTION_KEY), leaves `t2` alone, reports unreadable rows, writes
 * nothing on a dry run, and only overwrites a row whose value did not change meanwhile.
 */

type Call = { op: string; set?: Record<string, unknown> };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    where: () => c,
    returning: () => c,
    set: (v: Record<string, unknown>) => {
      call.set = v;
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

vi.mock('@/db/client', () => ({ db: { select: op('select'), update: op('update'), insert: op('insert') } }));
vi.mock('@/db/repositories/audit-events', () => ({ recordAuditEvent: vi.fn() }));
vi.mock('@/db/repositories/notification-prefs', () => ({ systemGetWhatsAppGatePrefs: vi.fn() }));

const { systemReencryptTotpSecrets } = await import('@/db/repositories/profiles');
const { decryptTotpSecret } = await import('@/lib/totp/secret-box');

const KEY = randomBytes(32).toString('base64');
const SECRET = 'GEZDGNBVGY3TQOJQ';

function legacySeal(authSecret: string, profileId: string): string {
  const key = createHash('sha256').update(`totp-secret:v1:${authSecret}`).digest();
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  c.setAAD(Buffer.from(`totp:${profileId}`, 'utf8'));
  const data = Buffer.concat([c.update(SECRET, 'utf8'), c.final()]);
  return `t1:${iv.toString('base64')}:${c.getAuthTag().toString('base64')}:${data.toString('base64')}`;
}

describe('systemReencryptTotpSecrets', () => {
  beforeEach(() => {
    calls.length = 0;
    results = [];
    vi.stubEnv('AUTH_SECRET', 'auth-a');
    vi.stubEnv('CREDENTIALS_ENCRYPTION_KEY', KEY);
  });
  afterEach(() => vi.unstubAllEnvs());

  it('moves t1 rows to t2 and reports unreadable ones', async () => {
    results = [
      [
        { id: 'p1', enc: legacySeal('auth-a', 'p1') },
        { id: 'p2', enc: legacySeal('auth-unknown', 'p2') },
      ],
      [{ id: 'p1' }],
    ];
    const report = await systemReencryptTotpSecrets();
    expect(report).toMatchObject({ checked: 2, moved: 1, current: 0, unreadable: ['p2'], skipped: 0 });
    const update = calls.find((c) => c.op === 'update');
    const enc = String(update?.set?.totpSecretEnc);
    expect(enc.startsWith('t2:')).toBe(true);
    expect(decryptTotpSecret('p1', enc)).toBe(SECRET);
  });

  it('writes nothing on a dry run', async () => {
    results = [[{ id: 'p1', enc: legacySeal('auth-a', 'p1') }]];
    const report = await systemReencryptTotpSecrets({ dryRun: true });
    expect(report.moved).toBe(1);
    expect(calls.some((c) => c.op === 'update')).toBe(false);
  });

  it('counts a row that changed during the run as skipped', async () => {
    results = [[{ id: 'p1', enc: legacySeal('auth-a', 'p1') }], []];
    const report = await systemReencryptTotpSecrets();
    expect(report).toMatchObject({ moved: 0, skipped: 1 });
  });

  it('refuses to run without CREDENTIALS_ENCRYPTION_KEY', async () => {
    vi.stubEnv('CREDENTIALS_ENCRYPTION_KEY', '');
    results = [[{ id: 'p1', enc: legacySeal('auth-a', 'p1') }]];
    await expect(systemReencryptTotpSecrets()).rejects.toThrow(/CREDENTIALS_ENCRYPTION_KEY/);
  });
});
