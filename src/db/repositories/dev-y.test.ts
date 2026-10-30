import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';
import { devDb } from './dev-test-db';

/**
 * Round Y: failed mail kept for retry, the exports log and the test mail setting. The console
 * reads refuse anyone but the developer and the super admin before a query runs; addresses
 * are masked and a client's file name is never shown.
 */

vi.mock('@/db/client', async () => (await import('./dev-test-db')).mockDbModule);

const failed = await import('./failed-emails');
const exportsRepo = await import('./export-files');
const settings = await import('./dev-settings');

const ctx = (role: AuthContext['role'], userId = `u-${role}`): AuthContext => ({ userId, email: `${role}@x.in`, name: role, role });
const NOW = new Date('2026-10-30T00:00:00Z');

beforeEach(() => devDb.reset());

describe('access rule', () => {
  it.each(['admin', 'manager', 'intern', 'client'] as const)('refuses %s', async (role) => {
    const c = ctx(role);
    for (const call of [
      () => failed.listFailedEmailsForDev(c),
      () => failed.getFailedEmailForDev(c, 'x'),
      () => failed.settleFailedEmailForDev(c, 'x', { ok: true, error: null }),
      () => exportsRepo.listExportFilesForDev(c),
      () => exportsRepo.exportKeyForDownloadForDev(c, 'x'),
      () => settings.getTestMailToForDev(c),
      () => settings.setTestMailToForDev(c, null),
    ])
      await expect(call()).rejects.toThrow('not permitted');
    expect(devDb.calls).toHaveLength(0);
  });
});

describe('failed mail', () => {
  it('lists with addresses masked and the subject scrubbed', async () => {
    devDb.results.push([
      { id: 'f1', to: ['priya@northwind.in'], subject: 'For priya@northwind.in', templateKey: 'welcome', error: 'Rejected', attempts: 2, hadAttachments: true, createdAt: NOW, lastAttemptAt: NOW },
    ]);
    const [row] = await failed.listFailedEmailsForDev(ctx('developer'));
    expect(row).toMatchObject({ to: 'p•••@northwind.in', canRetry: false, attempts: 2 });
    expect(row.subject).not.toContain('priya@');
  });

  it('deletes a mail that went out and counts a failed try', async () => {
    await failed.settleFailedEmailForDev(ctx('developer'), 'f1', { ok: true, error: null });
    await failed.settleFailedEmailForDev(ctx('developer'), 'f1', { ok: false, error: 'again' });
    expect(devDb.calls.map((c) => c.op)).toEqual(['delete', 'update']);
  });

  it('purges rows older than 30 days', async () => {
    devDb.results.push([{ id: 'a' }, { id: 'b' }]);
    expect(await failed.systemPurgeFailedEmails(NOW)).toBe(2);
  });
});

describe('exports', () => {
  const row = (over: Record<string, unknown>) => ({
    id: 'e1',
    kind: 'client_audit',
    format: 'csv',
    fileName: 'northwind-audit.csv',
    sizeBytes: 10,
    madeBy: 'u-client',
    objectKey: 'exports/2026-10/x.csv',
    createdAt: new Date('2026-10-29T00:00:00Z'),
    name: 'Northwind Pvt Ltd',
    email: 'c@northwind.in',
    role: 'client',
    ...over,
  });

  it('hides a client maker and file name, and offers download only to the maker or super admin', async () => {
    devDb.results.push([row({}), row({ id: 'e2', role: 'admin', name: 'Asha', madeBy: 'u-developer', fileName: 'audit-log.csv' })]);
    const out = await exportsRepo.listExportFilesForDev(ctx('developer'), NOW);
    expect(out[0]).toMatchObject({ madeBy: 'Client', fileName: 'client_audit.csv', canDownload: false, kept: true });
    expect(out[1]).toMatchObject({ madeBy: 'Asha', fileName: 'audit-log.csv', canDownload: true });
  });

  it('gives the key to the super admin, refuses another developer, and nothing after 30 days', async () => {
    devDb.results.push([row({ madeBy: 'u-someone' })], []);
    expect(await exportsRepo.exportKeyForDownloadForDev(ctx('super_admin'), 'e1', NOW)).toEqual({ key: 'exports/2026-10/x.csv', fileName: 'northwind-audit.csv' });
    devDb.results.push([row({ madeBy: 'u-someone' })]);
    expect(await exportsRepo.exportKeyForDownloadForDev(ctx('developer'), 'e1', NOW)).toBeNull();
    devDb.results.push([row({ createdAt: new Date('2026-09-01T00:00:00Z') })]);
    expect(await exportsRepo.exportKeyForDownloadForDev(ctx('super_admin'), 'e1', NOW)).toBeNull();
  });

  it('purges old rows and returns their S3 keys', async () => {
    devDb.results.push([{ key: 'exports/a' }, { key: null }]);
    expect(await exportsRepo.systemPurgeExportFiles(NOW)).toEqual(['exports/a']);
  });

  it('writes the row as the caller', async () => {
    await exportsRepo.recordExportFileForUser(ctx('client'), { kind: 'client_audit', format: 'csv', fileName: 'a.csv', sizeBytes: 3.4, objectKey: null });
    expect(devDb.calls.map((c) => c.op)).toEqual(['insert']);
  });
});

describe('test mail address', () => {
  it('reads it, and saves with an audit row', async () => {
    devDb.results.push([{ value: { to: 'dev@sbcllp.in' } }]);
    expect(await settings.getTestMailToForDev(ctx('developer'))).toBe('dev@sbcllp.in');
    devDb.results.push([], [], []);
    await settings.setTestMailToForDev(ctx('developer'), 'ops@sbcllp.in');
    expect(devDb.calls.filter((c) => c.op === 'insert')).toHaveLength(2);
  });
});
