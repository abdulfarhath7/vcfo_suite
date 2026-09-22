import PizZip from 'pizzip';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthContext } from '@/auth/guards';
import type { Engagement } from '@/data/engagements';
import { FINALIZED_BR, director, fullState } from '@/lib/doc-pack/__tests__/fixtures';
import type { DocPackAccess } from '@/db/repositories/doc-pack';

/**
 * Route-level proof of the document pack's access rules and responses.
 *
 * Guards and the repository are stubbed with the same shape they have in
 * production; storage is stubbed with real docx bytes so the sanitiser and
 * the zip run for real. Tenant scoping itself (`assertEngagementAccess`) is
 * exercised by the repository test beside this one.
 */

vi.mock('server-only', () => ({}));

let role: AuthContext['role'] = 'intern';
let internId = 'lead-1';
let userId = 'mgr-1';

vi.mock('@/auth/guards', () => ({
  requireAnyRole: async (...roles: string[]) => {
    const ctx: AuthContext = { userId, email: `${role}@vcfo.local`, name: role, role, internId };
    if (roles.includes(role) || (role === 'super_admin' && roles.includes('admin'))) {
      return { ok: true, ctx };
    }
    return { ok: false, status: 403, error: `Requires one of: ${roles.join(', ')}` };
  },
}));

const ENGAGEMENT: Engagement = {
  id: 'eng-1',
  slug: 'test-company',
  clientId: 'client-1',
  companyName: 'Test Company Private Limited',
  companyType: 'foreign',
  internId: 'lead-1',
  adminId: 'admin-1',
  managerId: 'mgr-1',
  createdAt: '2026-09-01T00:00:00.000Z',
  stage: 'Pre-Incorporation',
  health: 'on-track',
  parentEntityName: 'Test Parent Inc',
  parentEntityAddress: '100 Parent Road, Salt Lake City, Utah, USA',
};

let brRow: typeof FINALIZED_BR | null = FINALIZED_BR;
let checklistState = fullState([director('e1', 'no', 'Alpha'), director('e2', 'yes', 'Beta')]);

vi.mock('@/db/repositories/doc-pack', () => ({
  getDocPackInputs: async (ctx: AuthContext): Promise<DocPackAccess> => {
    if (ctx.role === 'client') return { ok: false, status: 403, error: 'forbidden' };
    if (ctx.role === 'intern' && ctx.internId !== 'lead-1') return { ok: false, status: 403, error: 'forbidden' };
    if (ctx.role === 'manager' && ctx.userId !== 'mgr-1') return { ok: false, status: 403, error: 'forbidden' };
    return {
      ok: true,
      inputs: { dbId: 'eng-1', engagement: ENGAGEMENT, checklistState, brRow },
    };
  },
}));

const audit = vi.fn();
vi.mock('@/db/repositories/audit-events', () => ({
  recordAuditEvent: (...args: unknown[]) => {
    audit(...args);
    return Promise.resolve();
  },
}));

const storedDocx = vi.fn<() => Promise<ArrayBuffer | null>>();
vi.mock('@/lib/incorporation-docs/storage', () => ({
  downloadIncorpDocx: () => storedDocx(),
}));
vi.mock('@/storage/board-resolution', () => ({
  downloadBoardResolutionDocx: () => storedDocx(),
}));

const summaryRoute = await import('@/../app/api/engagements/[id]/doc-pack/route');
const itemRoute = await import('@/../app/api/engagements/[id]/doc-pack/[itemKey]/route');
const zipRoute = await import('@/../app/api/engagements/[id]/doc-pack/zip/route');
const { renderIncorpDocxBuffer } = await import('@/lib/incorporation-docs/docx');

const params = () => ({ params: Promise.resolve({ id: 'eng-1' }) });
const itemParams = (itemKey: string) => ({ params: Promise.resolve({ id: 'eng-1', itemKey }) });
const req = (path: string) => new Request(`http://localhost/api/engagements/eng-1/doc-pack${path}`);

/** Real docx bytes for the "stored" file, so the sanitiser sees a genuine archive. */
function realDocxArrayBuffer(): ArrayBuffer {
  const buf = renderIncorpDocxBuffer('inc-9', {
    engagement: ENGAGEMENT,
    pre1: {},
    pre5: { approvedCompanyName: 'Stored Company Private Limited' },
    pre6: { residentDirectorFirstName: 'Stored', residentDirectorLastName: 'Director' },
    director: 'resident',
  });
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

beforeEach(() => {
  role = 'intern';
  internId = 'lead-1';
  userId = 'mgr-1';
  audit.mockClear();
  storedDocx.mockReset();
  storedDocx.mockResolvedValue(realDocxArrayBuffer());
  brRow = FINALIZED_BR;
  checklistState = fullState([director('e1', 'no', 'Alpha'), director('e2', 'yes', 'Beta')]);
});

describe('doc-pack routes — access', () => {
  it('client gets 403 on all four routes', async () => {
    role = 'client';
    const responses = await Promise.all([
      summaryRoute.GET(req(''), params()),
      itemRoute.GET(req('/inc-9:resident'), itemParams('inc-9:resident')),
      itemRoute.GET(req('/inc-9:resident?preview=1'), itemParams('inc-9:resident')),
      zipRoute.GET(req('/zip'), params()),
    ]);
    expect(responses.map((r) => r.status)).toEqual([403, 403, 403, 403]);
    expect(audit).not.toHaveBeenCalled();
  });

  it('a lead who is not on the engagement gets 403', async () => {
    internId = 'someone-else';
    expect((await summaryRoute.GET(req(''), params())).status).toBe(403);
    expect((await zipRoute.GET(req('/zip'), params())).status).toBe(403);
  });

  it('a manager who does not own the engagement gets 403', async () => {
    role = 'manager';
    userId = 'other-manager';
    expect((await summaryRoute.GET(req(''), params())).status).toBe(403);
    expect((await itemRoute.GET(req('/moa:company'), itemParams('moa:company'))).status).toBe(403);
  });

  it('admin, manager, lead and super admin can read the summary', async () => {
    for (const r of ['admin', 'manager', 'intern', 'super_admin'] as const) {
      role = r;
      const res = await summaryRoute.GET(req(''), params());
      expect(res.status, r).toBe(200);
      const body = (await res.json()) as { ok: boolean; pack: { total: number; counts: { ready: number } } };
      expect(body.ok).toBe(true);
      expect(body.pack.counts.ready).toBe(body.pack.total);
    }
  });
});

describe('doc-pack routes — documents', () => {
  it('returns 409 for an item that is not ready and writes no audit', async () => {
    checklistState = fullState([director('e1', 'no', 'Alpha'), director('e2', 'yes', 'Beta', { panNumber: '' })]);
    const res = await itemRoute.GET(req('/dir-2:resident'), itemParams('dir-2:resident'));
    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe('not_ready');
    expect(audit).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown item key', async () => {
    const res = await itemRoute.GET(req('/nope:company'), itemParams('nope:company'));
    expect(res.status).toBe(404);
  });

  it('renders a ready item on demand as .docx and audits the download', async () => {
    const res = await itemRoute.GET(req('/inc-9:resident'), itemParams('inc-9:resident'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(res.headers.get('content-disposition')).toMatch(/^attachment; filename="inc-9-resident-director-beta-director\.docx"$/);
    const zip = new PizZip(Buffer.from(await res.arrayBuffer()));
    expect(zip.file('word/document.xml')?.asText()).toContain('Test Company Private Limited');
    expect(storedDocx).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0]?.[1]).toMatchObject({
      action: 'doc_pack.download',
      metadata: { itemKey: 'inc-9:resident', source: 'generated' },
    });
  });

  it('serves the attached Pre-7 file when one exists', async () => {
    checklistState = fullState([director('e1', 'no', 'Alpha'), director('e2', 'yes', 'Beta')], {
      pre7: { residentDirectorInc9DraftUrl: 'eng-uuid/residentDirectorInc9DraftUrl/1756720000000-inc-9.docx' },
    });
    const res = await itemRoute.GET(req('/inc-9:resident'), itemParams('inc-9:resident'));
    expect(res.status).toBe(200);
    expect(storedDocx).toHaveBeenCalledTimes(1);
    const zip = new PizZip(Buffer.from(await res.arrayBuffer()));
    expect(zip.file('word/document.xml')?.asText()).toContain('Stored Company Private Limited');
    expect(audit.mock.calls[0]?.[1]).toMatchObject({ metadata: { source: 'attached' } });
  });

  it('preview serves inline and is not audited', async () => {
    const res = await itemRoute.GET(req('/moa:company?preview=1'), itemParams('moa:company'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toMatch(/^inline; filename="moa\.docx"$/);
    expect(audit).not.toHaveBeenCalled();
  });

  it('serves the finalized board resolution from storage, never rendering it', async () => {
    const res = await itemRoute.GET(req('/board-resolution:company'), itemParams('board-resolution:company'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toContain('board-resolution.docx');
    expect(storedDocx).toHaveBeenCalledTimes(1);
  });
});

describe('doc-pack routes — zip', () => {
  it('bundles every ready item and audits once', async () => {
    const res = await zipRoute.GET(req('/zip'), params());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/zip');
    expect(res.headers.get('content-disposition')).toMatch(
      /^attachment; filename="test-company-pre-incorporation-\d{4}-\d{2}-\d{2}\.zip"$/,
    );
    const zip = new PizZip(Buffer.from(await res.arrayBuffer()));
    const names = Object.keys(zip.files).sort();
    expect(names).toContain('board-resolution.docx');
    expect(names).toContain('moa.docx');
    expect(names).toContain('dir-2-non-resident-director-alpha-director.docx');
    const summary = (await (await summaryRoute.GET(req(''), params())).json()) as { pack: { total: number } };
    expect(names).toHaveLength(summary.pack.total);
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0]?.[1]).toMatchObject({ action: 'doc_pack.download_zip' });
  });

  it('returns 409 when nothing is ready', async () => {
    checklistState = {};
    brRow = null;
    role = 'admin';
    const res = await zipRoute.GET(req('/zip'), params());
    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe('none_ready');
    expect(audit).not.toHaveBeenCalled();
  });
});
