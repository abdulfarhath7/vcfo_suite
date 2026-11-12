import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';

/**
 * GL-06 / GL-08: the two export routes. The Excel route takes a list's filters, never its rows
 * (only the Directors grid may send rows), names the file by the GL-08 pattern, and refuses the
 * super admin's list to other roles. The audit log CSV reads every matching event through the
 * same server source as the Excel export.
 */

vi.mock('server-only', () => ({}));

let ctx: AuthContext = { role: 'manager', userId: 'me', email: 'me@x.test', name: 'Me' };
vi.mock('@/auth/guards', () => ({
  requireAuth: async () => ({ ok: true, ctx }),
  requireAnyRole: async (...roles: string[]) => (roles.includes(ctx.role) ? { ok: true, ctx } : { ok: false, status: 403, error: 'forbidden' }),
}));

const exportInBackground = vi.fn();
vi.mock('@/lib/exports/background-export', () => ({ exportInBackground: (...a: unknown[]) => exportInBackground(...a) }));

const listSourceTable = vi.fn();
const auditLogExportRows = vi.fn();
vi.mock('@/lib/exports/list-sources', async () => {
  const actual = await vi.importActual<typeof import('@/lib/exports/list-sources')>('@/lib/exports/list-sources');
  return {
    clientColumnOf: actual.clientColumnOf,
    keepScopedRows: actual.keepScopedRows,
    normaliseName: actual.normaliseName,
    scopedClientNameSet: async () => new Set(['ember technologies private limited']),
    listSourceTable: (...a: unknown[]) => listSourceTable(...a),
    auditLogExportRows: (...a: unknown[]) => auditLogExportRows(...a),
  };
});
vi.mock('@/lib/exports/sources/staff-lists', () => ({}));
vi.mock('@/lib/exports/sources/compliance-lists', () => ({}));
vi.mock('@/db/repositories/audit-events', () => ({ listAuditEvents: vi.fn() }));
vi.mock('@/db/repositories/engagements', () => ({ listEngagements: vi.fn() }));
vi.mock('@/lib/ask/tools/staff-data', () => ({ loadStaffEngagements: vi.fn() }));

const recordExport = vi.fn();
vi.mock('@/lib/exports/record-export', () => ({ recordExport: (...a: unknown[]) => recordExport(...a) }));

const xlsx = await import('../../../app/api/exports/xlsx/route');
const auditCsv = await import('../../../app/api/exports/audit-log/route');
const { downloadDateStamp } = await import('@/lib/files/download-name');

const post = (body: unknown) =>
  xlsx.POST(new Request('http://x.test/api/exports/xlsx', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));

beforeEach(() => {
  vi.clearAllMocks();
  ctx = { role: 'manager', userId: 'me', email: 'me@x.test', name: 'Me' };
});

describe('POST /api/exports/xlsx', () => {
  it('queues a list from its filters, with the GL-08 file name of a client the caller may see', async () => {
    const res = await post({ title: 'Compliance calendar', client: 'Ember Technologies Private Limited', source: { source: 'compliance-calendar', companyId: 'e1', monthKey: '2026-11' } });
    expect(res.status).toBe(202);
    const { fileName } = (await res.json()) as { fileName: string };
    expect(fileName).toBe(`Compliance-calendar_Ember-Technologies-Private-Limited_${downloadDateStamp()}.xlsx`);
    expect(exportInBackground).toHaveBeenCalledTimes(1);
    // The defaults of the filters are filled in before the server reads the rows.
    listSourceTable.mockResolvedValue({ sheet: 'x', columns: ['A'], rows: [] });
    await exportInBackground.mock.calls[0]![1].build();
    expect(listSourceTable.mock.calls[0]![2]).toMatchObject({ source: 'compliance-calendar', view: 'month', cat: 'all', areas: [] });
  });

  it('leaves a client the caller cannot see out of the file name', async () => {
    const res = await post({ title: 'Projects', client: 'Someone Else Private Limited', source: { source: 'firm-projects' } });
    expect(((await res.json()) as { fileName: string }).fileName).toBe(`Projects_${downloadDateStamp()}.xlsx`);
  });

  it('refuses rows from a list that has a server source', async () => {
    const res = await post({ title: 'Clients', columns: ['Client'], rows: [['Someone Else Private Limited']] });
    expect(res.status).toBe(400);
    expect(exportInBackground).not.toHaveBeenCalled();
  });

  it('still takes the Directors grid’s rows, scoped by client', async () => {
    const res = await post({ title: 'Directors', columns: ['Director', 'Client'], rows: [['A', 'Ember Technologies Private Limited'], ['B', 'Someone Else']] });
    expect(res.status).toBe(202);
    expect(exportInBackground).toHaveBeenCalledTimes(1);
  });

  it('refuses the super admin’s Clients list to other roles', async () => {
    const res = await post({ title: 'Clients', source: { source: 'super-clients' } });
    expect(res.status).toBe(403);
    ctx = { ...ctx, role: 'super_admin' };
    expect((await post({ title: 'Clients', source: { source: 'super-clients' } })).status).toBe(202);
  });

  it('rejects an unknown source', async () => {
    expect((await post({ title: 'Clients', source: { source: 'everything' } })).status).toBe(400);
  });
});

describe('GET /api/exports/audit-log', () => {
  it('builds the CSV from every matching event through the server source and logs it', async () => {
    auditLogExportRows.mockResolvedValue([
      ['11 Nov 2026', '11:30', 'Downloaded', 'MOA "draft"', 'Documents', 'Leo', 'Project lead', 'l@x.test', 'Done', 'Ember Technologies Private Limited'],
    ]);
    const res = await auditCsv.GET(
      new Request('http://x.test/api/exports/audit-log?search=moa&role=intern&category=documents&engagementId=db-1&name=audit-log-project.csv&client=Ember%20Technologies%20Private%20Limited'),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text.split('\n')).toHaveLength(2);
    expect(text).toContain('"MOA ""draft"""');
    expect(auditLogExportRows.mock.calls[0]![1]).toEqual({ engagementId: 'db-1', filters: { search: 'moa', role: 'intern', category: 'documents' } });
    const name = `audit-log-project_Ember-Technologies-Private-Limited_${downloadDateStamp()}.csv`;
    expect(res.headers.get('content-disposition')).toBe(`attachment; filename="${name}"`);
    expect(recordExport.mock.calls[0]![1]).toMatchObject({ kind: 'audit_log', format: 'csv', fileName: name });
  });

  it('is staff only', async () => {
    ctx = { ...ctx, role: 'client' };
    expect((await auditCsv.GET(new Request('http://x.test/api/exports/audit-log'))).status).toBe(403);
  });
});
