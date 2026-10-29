import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthContext } from '@/auth/guards';
import type { FilingRow } from '@/lib/compliance/filings';
import { filingHits, matchesQuery, obligationHits, regLabelOf } from '@/lib/search/staff-search';

/**
 * Staff search (Ctrl K). The pure hit builders, and route-level proof that `GET /api/search`
 * reads only through the scoped `getFilings` with the caller's own context and refuses the
 * roles that have no staff search. Tenant scoping of `getFilings` itself is exercised in
 * `src/db/repositories/filings.test.ts`.
 */

vi.mock('server-only', () => ({}));

let role: AuthContext['role'] = 'intern';

vi.mock('@/auth/guards', () => ({
  requireAnyRole: async (...roles: string[]) => {
    const ctx: AuthContext = { userId: `${role}-1`, email: `${role}@vcfo.local`, name: role, role, internId: 'lead-1' };
    if (roles.includes(role) || (role === 'super_admin' && roles.includes('admin'))) return { ok: true, ctx };
    return { ok: false, status: 403, error: `Requires one of: ${roles.join(', ')}` };
  },
}));

function row(over: Partial<FilingRow>): FilingRow {
  return {
    id: 'i-1',
    engagementId: 'eng-own',
    companyName: 'Own Co Pvt Ltd',
    compliance: 'GST',
    particular: 'GSTR-3B',
    authority: 'GSTN',
    frequency: 'Monthly',
    dueDate: '2026-11-20',
    filedOn: null,
    periodLabel: 'Oct 2026',
    fyLabel: 'FY 2026-27',
    rawStatus: 'pending',
    obligationId: 'ob-gstr3b',
    windowFrom: null,
    windowTo: null,
    ...over,
  };
}

/* The scoped register: what `getFilings` returns for this caller. The other firm member's
   engagement (`eng-other`) is never in it, because the repository leaves it out. */
const scopedRows = vi.fn<(ctx: AuthContext) => FilingRow[]>(() => [row({})]);
const getFilings = vi.fn(async (ctx: AuthContext) => ({ rows: scopedRows(ctx), companies: [] }));
vi.mock('@/db/repositories/filings', () => ({ getFilings: (ctx: AuthContext) => getFilings(ctx) }));

const NOW = new Date('2026-11-01T00:00:00Z');

describe('staff search hits', () => {
  it('matches every word of the query, case free', () => {
    expect(matchesQuery('GSTR-3B GST Own Co', 'gstr own')).toBe(true);
    expect(matchesQuery('GSTR-3B GST Own Co', 'gstr tds')).toBe(false);
    expect(matchesQuery('anything', '  ')).toBe(false);
  });

  it('reads a regulator from the area or the authority', () => {
    expect(regLabelOf('GST')).toBe('GST');
    expect(regLabelOf('Income Tax')).toBe('Income tax');
    expect(regLabelOf('Other', 'MCA')).toBe('MCA');
    expect(regLabelOf('Other')).toBeUndefined();
  });

  it('builds a filing hit with status, regulator, client and a link inside the shell', () => {
    const [hit] = filingHits([row({})], 'gstr', '/app/manager', NOW);
    expect(hit).toMatchObject({
      group: 'Filings',
      title: 'GSTR-3B',
      mono: 'Oct 2026',
      status: 'Not started',
      reg: 'GST',
      client: 'Own Co Pvt Ltd',
      href: '/app/manager/compliances/filings?company=eng-own&fy=2026',
    });
  });

  it('puts open filings before filed ones', () => {
    const hits = filingHits(
      [row({ id: 'done', filedOn: '2026-10-10', dueDate: '2026-10-20' }), row({ id: 'late', dueDate: '2026-10-25' })],
      'gstr',
      '/app/admin',
      NOW,
    );
    expect(hits.map((h) => h.status)).toEqual(['Overdue', 'Done']);
  });

  it('groups obligations, keeps the worst open status and counts clients', () => {
    const hits = obligationHits(
      [row({ id: 'a', dueDate: '2026-10-25' }), row({ id: 'b', engagementId: 'eng-2', companyName: 'Two Co', dueDate: '2026-12-20' })],
      'gstr',
      '/app/admin',
      NOW,
    );
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ group: 'Obligations', status: 'Overdue', href: '/app/admin/compliances/obligations/ob-gstr3b' });
    expect(hits[0]!.sub).toContain('2 clients');
    expect(hits[0]!.client).toBeUndefined();
  });
});

describe('GET /api/search', () => {
  beforeEach(() => {
    getFilings.mockClear();
    scopedRows.mockImplementation(() => [row({})]);
  });

  async function call(q: string) {
    const { GET } = await import('../../../app/api/search/route');
    return GET(new Request(`http://local/api/search?q=${encodeURIComponent(q)}`));
  }

  it('reads the register with the caller’s own context only', async () => {
    role = 'manager';
    const res = await call('gstr');
    expect(res.status).toBe(200);
    expect(getFilings).toHaveBeenCalledTimes(1);
    expect(getFilings.mock.calls[0]![0]).toMatchObject({ role: 'manager', userId: 'manager-1' });
    const { hits } = (await res.json()) as { hits: Array<{ href: string; client?: string }> };
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.href.startsWith('/app/manager/'))).toBe(true);
  });

  it('never returns an engagement the repository left out of scope', async () => {
    role = 'intern';
    // The lead's scope holds one engagement; another member's engagement is not in it.
    scopedRows.mockImplementation((ctx) => (ctx.role === 'intern' ? [row({})] : [row({}), row({ id: 'x', engagementId: 'eng-other', companyName: 'Other Co' })]));
    const res = await call('gstr');
    const { hits } = (await res.json()) as { hits: Array<{ href: string; client?: string }> };
    expect(hits.some((h) => h.href.includes('eng-other') || h.client === 'Other Co')).toBe(false);
    expect(hits.every((h) => h.href.startsWith('/app/intern/'))).toBe(true);
  });

  it('refuses a client and a developer', async () => {
    role = 'client';
    expect((await call('gstr')).status).toBe(403);
    role = 'developer' as AuthContext['role'];
    expect((await call('gstr')).status).toBe(403);
    expect(getFilings).not.toHaveBeenCalled();
  });

  it('reads nothing for a one-letter query', async () => {
    role = 'admin';
    const res = await call('g');
    expect(((await res.json()) as { hits: unknown[] }).hits).toEqual([]);
    expect(getFilings).not.toHaveBeenCalled();
  });
});
