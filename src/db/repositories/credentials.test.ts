import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthContext } from '@/auth/guards';

/**
 * Cross-tenant scoping for the credentials vault (client portal v7, Path A).
 *
 * Every exported function resolves access first:
 *   client — only its own engagement (`getMyEngagement`); naming any other
 *            engagement id must pass `assertEngagementAccess` or it is a 403,
 *   staff  — an explicit engagement id that passes `assertEngagementAccess`,
 *            otherwise 404 (missing) or 403 (out of scope).
 * These tests prove that a refused engagement never reaches the database, so
 * neither the secrets nor the access log of another firm's company can be
 * read or written.
 */

const dbSelect = vi.fn();
const dbInsert = vi.fn();
const dbUpdate = vi.fn();
const dbDelete = vi.fn();
vi.mock('@/db/client', () => ({
  db: {
    select: (...a: unknown[]) => dbSelect(...a),
    insert: (...a: unknown[]) => dbInsert(...a),
    update: (...a: unknown[]) => dbUpdate(...a),
    delete: (...a: unknown[]) => dbDelete(...a),
  },
}));

const assertEngagementAccess = vi.fn();
const getMyEngagement = vi.fn();
vi.mock('@/db/repositories/engagements', () => ({
  assertEngagementAccess: (...a: unknown[]) => assertEngagementAccess(...a),
  getMyEngagement: (...a: unknown[]) => getMyEngagement(...a),
  checklistStateForViewer: vi.fn(() => ({})),
  checklistStateFromRow: vi.fn(() => ({})),
}));
vi.mock('@/db/repositories/engagement-recipients', () => ({
  resolveEngagementRecipients: vi.fn(async () => ({ to: [], cc: [] })),
}));
vi.mock('@/db/repositories/audit-events', () => ({
  recordAuditEvent: vi.fn(),
}));

const repo = await import('@/db/repositories/credentials');

const OWN = '11111111-1111-1111-1111-111111111101';
const OTHER = '22222222-2222-2222-2222-222222222202';

function ctx(role: AuthContext['role']): AuthContext {
  return { userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role };
}

function noDbCalls() {
  expect(dbSelect).not.toHaveBeenCalled();
  expect(dbInsert).not.toHaveBeenCalled();
  expect(dbUpdate).not.toHaveBeenCalled();
  expect(dbDelete).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  getMyEngagement.mockResolvedValue({ id: OWN });
  assertEngagementAccess.mockImplementation(async (_ctx: AuthContext, id: string) =>
    id === OWN ? { ok: true, dbId: OWN, row: { id: OWN } } : { ok: false, dbId: id, forbidden: true },
  );
});

describe('client cannot reach another firm’s credentials', () => {
  it('getCredentials with a foreign engagement id is a 403 before any query', async () => {
    await expect(repo.getCredentials(ctx('client'), OTHER)).rejects.toMatchObject({
      code: 'forbidden',
      status: 403,
    });
    expect(assertEngagementAccess).toHaveBeenCalledWith(ctx('client'), OTHER);
    noDbCalls();
  });

  it('listCredentialsLog with a foreign engagement id is a 403 before any query', async () => {
    await expect(repo.listCredentialsLog(ctx('client'), OTHER)).rejects.toMatchObject({ status: 403 });
    noDbCalls();
  });

  it('requestCredentialOtp with a foreign engagement id is a 403 and issues no code', async () => {
    await expect(
      repo.requestCredentialOtp(ctx('client'), { engagementId: OTHER, mode: 'preview', scope: 'tab:login' }),
    ).rejects.toMatchObject({ status: 403 });
    noDbCalls();
  });

  it('a client with no engagement of its own gets 404, not someone else’s', async () => {
    getMyEngagement.mockResolvedValue(null);
    await expect(repo.getCredentials(ctx('client'), OTHER)).rejects.toMatchObject({ status: 404 });
    expect(assertEngagementAccess).not.toHaveBeenCalled();
    noDbCalls();
  });
});

describe('staff cannot reach credentials outside their scope', () => {
  it.each(['manager', 'intern'] as const)('%s on another firm’s engagement is a 403', async (role) => {
    await expect(repo.getCredentials(ctx(role), OTHER)).rejects.toMatchObject({ status: 403 });
    await expect(repo.listCredentialsLog(ctx(role), OTHER)).rejects.toMatchObject({ status: 403 });
    await expect(
      repo.updateCredentialCell(ctx(role), { engagementId: OTHER, key: 'login|0|1', value: 'x' }),
    ).rejects.toMatchObject({ status: 403 });
    noDbCalls();
  });

  it.each(['manager', 'intern', 'admin', 'super_admin'] as const)(
    '%s must name an engagement; there is no implicit default',
    async (role) => {
      await expect(repo.getCredentials(ctx(role), null)).rejects.toMatchObject({
        code: 'engagement_required',
        status: 400,
      });
      noDbCalls();
    },
  );

  it('a missing engagement is a 404 for staff', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: false, dbId: OTHER, notFound: true });
    await expect(repo.getCredentials(ctx('admin'), OTHER)).rejects.toMatchObject({ code: 'not_found', status: 404 });
    noDbCalls();
  });
});
