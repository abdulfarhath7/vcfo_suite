import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthContext } from '@/auth/guards';
import type { Engagement } from '@/data/engagements';
import type { DocPackAccess } from '@/db/repositories/doc-pack';
import { assistFullState } from '@/lib/assist-profile/__tests__/fixtures';
import { ASSIST_PROFILE_SCHEMA_VERSION } from '@/lib/assist-profile/build';

/**
 * Route-level proof of the Assist profile's access rules and response shape.
 * Guards and the repository are stubbed with their production shape, as in
 * `doc-pack.test.ts`; tenant scoping itself is the repository's own test.
 */

vi.mock('server-only', () => ({}));

let role: AuthContext['role'] = 'intern';
let internId = 'lead-1';
let userId = 'mgr-1';
let visible = true;

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
  companyName: 'Test Company India Private Limited',
  companyType: 'foreign',
  internId: 'lead-1',
  adminId: 'admin-1',
  managerId: 'mgr-1',
  createdAt: '2026-09-01T00:00:00.000Z',
  stage: 'Pre-Incorporation',
  health: 'on-track',
};

vi.mock('@/db/repositories/doc-pack', () => ({
  getDocPackInputs: async (ctx: AuthContext): Promise<DocPackAccess> => {
    if (ctx.role === 'client') return { ok: false, status: 403, error: 'forbidden' };
    if (!visible) return { ok: false, status: 404, error: 'not_found' };
    if (ctx.role === 'intern' && ctx.internId !== 'lead-1') return { ok: false, status: 403, error: 'forbidden' };
    if (ctx.role === 'manager' && ctx.userId !== 'mgr-1') return { ok: false, status: 403, error: 'forbidden' };
    return {
      ok: true,
      inputs: { dbId: 'eng-1', engagement: ENGAGEMENT, checklistState: assistFullState(), brRow: null },
    };
  },
}));

const route = await import('@/../app/api/engagements/[id]/assist-profile/route');

const params = () => ({ params: Promise.resolve({ id: 'eng-1' }) });
const req = () => new Request('http://localhost/api/engagements/eng-1/assist-profile');

beforeEach(() => {
  role = 'intern';
  internId = 'lead-1';
  userId = 'mgr-1';
  visible = true;
});

describe('GET /api/engagements/[id]/assist-profile', () => {
  it('returns the profile, missing and notes to the assigned lead', async () => {
    const res = await route.GET(req(), params());
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('no-store');
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(['companyName', 'missing', 'notes', 'ok', 'profile', 'schemaVersion']);
    expect(body.ok).toBe(true);
    expect(body.schemaVersion).toBe(ASSIST_PROFILE_SCHEMA_VERSION);
    expect(body.companyName).toBe('Test Company India Private Limited');
    expect(body.profile.mcaLogin).toEqual({ userId: '' });
    expect(body.profile.directors).toHaveLength(2);
    expect(Array.isArray(body.missing)).toBe(true);
    expect(Array.isArray(body.notes)).toBe(true);
  });

  it('admin, manager, lead and super admin can read it', async () => {
    for (const r of ['admin', 'manager', 'intern', 'super_admin'] as const) {
      role = r;
      expect((await route.GET(req(), params())).status, r).toBe(200);
    }
  });

  it('a client gets 403', async () => {
    role = 'client';
    expect((await route.GET(req(), params())).status).toBe(403);
  });

  it('an unassigned lead or manager gets 403', async () => {
    internId = 'someone-else';
    expect((await route.GET(req(), params())).status).toBe(403);
    role = 'manager';
    userId = 'other-manager';
    expect((await route.GET(req(), params())).status).toBe(403);
  });

  it('an engagement that does not exist or is not visible gets 404', async () => {
    visible = false;
    expect((await route.GET(req(), params())).status).toBe(404);
  });

  it('exposes no write method', () => {
    expect(Object.keys(route).sort()).toEqual(['GET']);
  });
});
