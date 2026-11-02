import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';
import { devDb } from './dev-test-db';

/**
 * Developer console round X repositories: checks, switches, deploy images, migrations,
 * sessions, demo purge, message routes and database facts. Every one refuses anyone but the
 * developer and the super admin before a query runs, and none returns a client's details.
 */

vi.mock('@/db/client', async () => (await import('./dev-test-db')).mockDbModule);

const checks = await import('./dev-checks');
const settings = await import('./dev-settings');
const deploys = await import('./dev-deploys');
const access = await import('./dev-access');
const messages = await import('./dev-messages');
const data = await import('./dev-data');

const ctx = (role: AuthContext['role'], extra: Partial<AuthContext> = {}): AuthContext => ({
  userId: `00000000-0000-0000-0000-00000000000${role.length % 10}`,
  email: `${role}@vcfo.local`,
  name: role,
  role,
  ...extra,
});

beforeEach(() => devDb.reset());

const OTHERS = ['admin', 'manager', 'intern', 'client'] as const;

describe('access rule', () => {
  it.each(OTHERS)('refuses %s on every round X read and write without a query', async (role) => {
    const c = ctx(role);
    const calls = [
      () => checks.recordServiceCheckForDev(c, { service: 'email', ok: true, latencyMs: 1, detail: null }),
      () => checks.listServiceChecksForDev(c),
      () => checks.listConnectionEventsForDev(c, 'email'),
      () => settings.getDevSwitchForDev(c, 'jobs.paused'),
      () => settings.setDevSwitchForDev(c, 'jobs.paused', true),
      () => deploys.recordDeployImageForDev(c, 'repo:x'),
      () => deploys.listDeployImagesForDev(c, null),
      () => deploys.isKnownDeployImageForDev(c, 'repo:x'),
      () => deploys.listMigrationsForDev(c, []),
      () => deploys.lastDeployActorForDev(c),
      () => access.listSessionsForDev(c),
      () => access.revokeSessionForDev(c, '11111111-1111-1111-1111-111111111111'),
      () => access.signInMethodsForDev(c),
      () => access.purgeDemoLoginsForDev(c),
      () => messages.messageRoutesForDev(c, []),
      () => messages.failureCausesForDev(c),
      () => messages.emailTemplatesForDev(c),
      () => messages.messageTimingForDev(c),
      () => data.getDatabaseFactsForDev(c),
      () => data.getMonthVolumesForDev(c),
    ];
    for (const call of calls) await expect(call()).rejects.toThrow('not permitted');
    expect(devDb.calls).toHaveLength(0);
  });
});

describe('checks', () => {
  it('stores a scrubbed check and maps the newest first', async () => {
    devDb.results.push([{ id: 'c1', checkedAt: new Date('2026-10-30T00:00:00Z') }]);
    const out = await checks.recordServiceCheckForDev(ctx('developer'), { service: 'email', ok: false, latencyMs: 12.6, detail: 'refused for priya@northwind.in' });
    expect(out).toMatchObject({ id: 'c1', ok: false, latencyMs: 13, by: 'developer' });
    expect(out.detail).not.toContain('priya@northwind.in');

    devDb.results.push([{ id: 'c1', service: 'email', ok: true, latencyMs: 90, detail: null, checkedAt: new Date('2026-10-30T00:00:00Z'), by: null }]);
    expect(await checks.listServiceChecksForDev(ctx('super_admin'))).toEqual([
      { id: 'c1', service: 'email', ok: true, latencyMs: 90, detail: null, checkedAt: '2026-10-30T00:00:00.000Z', by: null },
    ]);
  });

  it('mixes checks and console actions into the event list', async () => {
    devDb.results.push(
      [{ id: 'c1', service: 'email', ok: true, latencyMs: 90, detail: 'SES answered', checkedAt: new Date('2026-10-30T01:00:00Z'), by: null }],
      [{ id: 'a1', at: new Date('2026-10-30T02:00:00Z'), summary: 'Test mail sent to p•••@x.in', result: 'ok' }],
    );
    const out = await checks.listConnectionEventsForDev(ctx('developer'), 'email');
    expect(out.map((e) => e.id)).toEqual(['audit-a1', 'check-c1']);
    expect(out[1].text).toBe('Test passed: SES answered');
  });
});

describe('switches', () => {
  it('reads off by default and writes the change with an audit row', async () => {
    devDb.results.push([]);
    expect(await settings.getDevSwitchForDev(ctx('developer'), 'jobs.paused')).toEqual({ on: false, by: null, at: null });
    devDb.results.push([], [], []);
    const out = await settings.setDevSwitchForDev(ctx('developer'), 'jobs.paused', true);
    expect(out.on).toBe(true);
    expect(devDb.calls.filter((c) => c.op === 'insert')).toHaveLength(2);
  });

  it('lets the jobs read the pause without a person, and treats a failure as not paused', async () => {
    devDb.results.push([{ value: { on: true } }]);
    expect(await settings.systemJobsPaused()).toBe(true);
    devDb.results.push(Promise.reject(new Error('down')));
    expect(await settings.systemJobsPaused()).toBe(false);
  });
});

describe('deploys', () => {
  it('marks the current image and reads migrations against the last applied one', async () => {
    devDb.results.push([
      { image: 'repo:b', firstSeenAt: new Date('2026-10-02T00:00:00Z'), lastSeenAt: new Date('2026-10-30T00:00:00Z') },
      { image: 'repo:a', firstSeenAt: new Date('2026-09-01T00:00:00Z'), lastSeenAt: new Date('2026-10-01T00:00:00Z') },
    ]);
    const imgs = await deploys.listDeployImagesForDev(ctx('developer'), 'repo:b');
    expect(imgs.map((i) => [i.image, i.current])).toEqual([
      ['repo:b', true],
      ['repo:a', false],
    ]);

    devDb.results.push({ rows: [{ last: '200' }] });
    const migs = await deploys.listMigrationsForDev(ctx('developer'), [
      { tag: '0001_a', when: 100 },
      { tag: '0002_b', when: 200 },
      { tag: '0003_c', when: 300 },
    ]);
    expect(migs.map((m) => [m.tag, m.status])).toEqual([
      ['0003_c', 'pending'],
      ['0002_b', 'applied'],
      ['0001_a', 'applied'],
    ]);
  });
});

describe('sessions and demo logins', () => {
  it('lists staff devices with the address cut short and marks the caller', async () => {
    devDb.results.push([
      {
        id: 's1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120',
        ip: '203.0.113.7',
        createdAt: new Date('2026-10-29T00:00:00Z'),
        lastSeenAt: new Date('2026-10-30T00:00:00Z'),
        name: 'Asha',
        email: 'asha@sbcllp.in',
        role: 'manager',
      },
    ]);
    const out = await access.listSessionsForDev(ctx('developer', { sessionId: 's1' }), new Date('2026-10-30T00:00:00Z'));
    expect(out[0]).toMatchObject({ person: 'Asha', ip: '203.0.x.x', current: true });
    expect(access.maskIp('2001:db8:1::1')).toBe('2001:db8:…');
  });

  it('refuses to revoke the caller’s own device or a bad id', async () => {
    expect(await access.revokeSessionForDev(ctx('developer', { sessionId: '11111111-1111-1111-1111-111111111111' }), '11111111-1111-1111-1111-111111111111')).toBeNull();
    expect(await access.revokeSessionForDev(ctx('developer'), 'nope')).toBeNull();
    expect(devDb.calls).toHaveLength(0);
  });

  it('revokes a staff device and writes the audit row', async () => {
    devDb.results.push([{ id: 's2', name: 'Asha', email: 'asha@sbcllp.in', role: 'manager' }], [{ id: 's2' }], []);
    expect(await access.revokeSessionForDev(ctx('developer'), '22222222-2222-2222-2222-222222222222')).toEqual({ person: 'Asha' });
    expect(devDb.calls.map((c) => c.op)).toEqual(['select', 'update', 'insert']);
  });

  it('turns off demo logins, signs their devices out and audits', async () => {
    devDb.results.push([{ id: 'p1' }, { id: 'p2' }], [], []);
    expect(await access.purgeDemoLoginsForDev(ctx('super_admin'))).toEqual({ accounts: 2 });
    expect(devDb.calls.map((c) => c.op)).toEqual(['update', 'update', 'insert']);
  });
});

describe('messages and data', () => {
  it('fills every route the code defines, with zeros when nothing was sent', async () => {
    devDb.results.push([{ event: 'welcome', channel: 'email', sent: 4, delivered: 3, failed: 1 }]);
    const out = await messages.messageRoutesForDev(ctx('developer'), [
      { event: 'welcome', channel: 'email', template: null },
      { event: 'welcome', channel: 'whatsapp', template: 'welcome' },
    ]);
    expect(out).toEqual([
      { event: 'welcome', channel: 'email', template: null, sent7d: 4, delivered7d: 3, failed7d: 1 },
      { event: 'welcome', channel: 'whatsapp', template: 'welcome', sent7d: 0, delivered7d: 0, failed7d: 0 },
    ]);
  });

  it('reads database facts and volumes as numbers', async () => {
    devDb.results.push({ rows: [{ version: '16.4', started: '2026-10-01T00:00:00Z', connections: 3, max_connections: 100, bytes: '1024', oldest_vacuum: null, dead_rows: '7' }] });
    expect(await data.getDatabaseFactsForDev(ctx('developer'))).toEqual({
      version: '16.4',
      startedAt: '2026-10-01T00:00:00.000Z',
      connections: 3,
      maxConnections: 100,
      bytes: 1024,
      oldestVacuum: null,
      deadRows: 7,
    });
    devDb.results.push({ rows: [{ emails: 5, whatsapp: 2, documents: 1, document_bytes: '10', audit_events: 9, sign_ins: 4 }] });
    expect(await data.getMonthVolumesForDev(ctx('developer'), new Date('2026-10-30T00:00:00Z'))).toEqual({
      since: '2026-10-01T00:00:00.000Z',
      emails: 5,
      whatsapp: 2,
      documents: 1,
      documentBytes: 10,
      auditEvents: 9,
      signIns: 4,
    });
  });
});

describe('system checks', () => {
  it('writes a check with no person and reads it back as "System"', async () => {
    await checks.systemRecordServiceCheck({ service: 'storage', ok: true, latencyMs: 40.4, detail: 'Bucket answered' });
    expect(devDb.calls.map((c) => c.op)).toEqual(['insert']);
    devDb.results.push([{ id: 's1', service: 'storage', ok: true, latencyMs: 40, detail: 'Bucket answered', checkedAt: new Date('2026-10-30T00:00:00Z'), checkedBy: null, by: null }]);
    const [row] = await checks.listServiceChecksForDev(ctx('developer'));
    expect(row.by).toBe('System');
  });
});
