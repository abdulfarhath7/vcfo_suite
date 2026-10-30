import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';

/**
 * Board resolution (NOC) repository (R-52): every read and write goes through
 * `getEngagementById`, so another tenant's engagement is "not found" and never written; a client
 * reads but never writes and never gets the staff block; Accept needs every receive check;
 * Send back needs a reason; Change template is for a manager or admin only.
 */

type Call = { op: string; set?: unknown; values?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    limit: () => c,
    orderBy: () => c,
    returning: () => c,
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
const op = (name: string) => () => {
  const call: Call = { op: name };
  calls.push(call);
  return chain(call);
};
vi.mock('server-only', () => ({}));
vi.mock('@/db/client', () => ({ db: { select: op('select'), update: op('update'), insert: op('insert'), delete: op('delete') } }));

const OWN = '11111111-1111-4111-8111-111111111101';
const OTHER = '22222222-2222-4222-8222-222222222202';
const ownEngagement = { id: OWN, ownershipType: 'subsidiary', companyType: 'domestic', parentIndianRelationship: 'investing', parentEntityName: 'Parent Ltd', checklistState: {} };
const getEngagementById = vi.fn();
vi.mock('@/db/repositories/engagements', () => ({
  getEngagementById: (...a: unknown[]) => getEngagementById(...a),
  checklistStateFromRow: () => ({}),
  toAppEngagement: (r: unknown) => r,
}));
const createDocument = vi.fn();
vi.mock('@/db/repositories/documents', () => ({ createDocument: (...a: unknown[]) => createDocument(...a) }));

const repo = await import('@/db/repositories/board-resolution-noc');

function ctx(role: string): AuthContext {
  return { userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role: role as AuthContext['role'] };
}

const signedRow = {
  engagementId: OWN,
  content: 'x',
  status: 'finalized',
  storagePath: 'br/own.docx',
  draftedAt: new Date('2026-10-01T00:00:00Z'),
  finalizedAt: new Date('2026-10-02T00:00:00Z'),
  signedStoragePath: 'engagement-documents/own/board-resolution/1-signed.pdf',
  signedUploadedAt: new Date('2026-10-03T00:00:00Z'),
  receiveChecks: {},
  notaryStepsOff: false,
  acceptedAt: null,
  updatedAt: new Date(),
};
const allTicked = {
  director_signature: { by: 'user-intern', at: 'x' },
  date_place: { by: 'user-intern', at: 'x' },
  letterhead: { by: 'user-intern', at: 'x' },
  names_match: { by: 'user-intern', at: 'x' },
};

beforeEach(() => {
  calls.length = 0;
  results = [];
  createDocument.mockReset();
  createDocument.mockResolvedValue({ id: 'doc-1' });
  getEngagementById.mockReset();
  getEngagementById.mockImplementation(async (_c: AuthContext, id: string) => (id === OWN ? ownEngagement : null));
});

describe('cross-tenant scope', () => {
  it.each(['client', 'intern', 'manager', 'admin', 'super_admin'])('%s reading another tenant gets null and no row read', async (role) => {
    expect(await repo.getNocState(ctx(role), OTHER)).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it.each([
    ['check', () => repo.setNocCheck(ctx('intern'), OTHER, 'letterhead', true)],
    ['accept', () => repo.acceptNoc(ctx('manager'), OTHER)],
    ['send back', () => repo.sendBackNoc(ctx('admin'), OTHER, 'Wrong stamp')],
    ['change template', () => repo.changeNocTemplate(ctx('super_admin'), OTHER, 'indian-name-only', 'Reason')],
    ['notary steps', () => repo.setNocNotarySteps(ctx('manager'), OTHER, true)],
    ['versions', () => repo.listBoardResolutionVersions(ctx('manager'), OTHER)],
  ])('%s on another tenant is not found and writes nothing', async (_name, run) => {
    await expect(run()).rejects.toThrow(/not found or not permitted/);
    expect(calls.filter((c) => c.op !== 'select')).toHaveLength(0);
    expect(createDocument).not.toHaveBeenCalled();
  });

  it('a developer reads nothing', async () => {
    expect(await repo.getNocState(ctx('developer'), OWN)).toBeNull();
    expect(getEngagementById).not.toHaveBeenCalled();
  });
});

describe('roles', () => {
  it('a client reads its own state without the staff block', async () => {
    results = [[signedRow], []];
    const s = await repo.getNocState(ctx('client'), OWN);
    expect(s?.staff).toBeUndefined();
    expect(s?.variant).toBe('indian-investing');
    expect(s?.track).toHaveLength(4);
  });

  it('a client sees no document before release', async () => {
    results = [[{ ...signedRow, status: 'draft', signedStoragePath: null }], []];
    const s = await repo.getNocState(ctx('client'), OWN);
    expect(s?.track.every((t) => !t.done)).toBe(true);
  });

  it.each([
    ['check', () => repo.setNocCheck(ctx('client'), OWN, 'letterhead', true)],
    ['accept', () => repo.acceptNoc(ctx('client'), OWN)],
    ['send back', () => repo.sendBackNoc(ctx('client'), OWN, 'x')],
  ])('a client may not %s', async (_n, run) => {
    await expect(run()).rejects.toThrow(/Only staff/);
    expect(getEngagementById).not.toHaveBeenCalled();
  });

  it('a lead may not change the template or the notary steps', async () => {
    await expect(repo.changeNocTemplate(ctx('intern'), OWN, 'indian-name-only', 'Reason')).rejects.toThrow(/manager or admin/);
    await expect(repo.setNocNotarySteps(ctx('intern'), OWN, true)).rejects.toThrow(/manager or admin/);
    expect(calls).toHaveLength(0);
  });
});

describe('receive', () => {
  it('Accept is refused until every check is ticked', async () => {
    results = [[{ ...signedRow, receiveChecks: { letterhead: { by: 'u', at: 'x' } } }]];
    await expect(repo.acceptNoc(ctx('intern'), OWN)).rejects.toThrow('checks_incomplete');
    expect(calls.filter((c) => c.op === 'update')).toHaveLength(0);
  });

  it('Accept with every check stamps accepted and files the copy to the Vault', async () => {
    const accepted = { ...signedRow, receiveChecks: allTicked, acceptedAt: new Date(), acceptedBy: 'user-manager', vaultDocumentId: 'doc-1' };
    results = [[{ ...signedRow, receiveChecks: allTicked }], [accepted], []];
    const s = await repo.acceptNoc(ctx('manager'), OWN);
    expect(createDocument).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ engagementId: OWN, stepId: 'pre-3', sharedWithClient: true, objectKey: signedRow.signedStoragePath }));
    const upd = calls.find((c) => c.op === 'update');
    expect(upd?.set).toMatchObject({ acceptedBy: 'user-manager', vaultDocumentId: 'doc-1', sentBackReason: null });
    expect(s.accepted).toBe(true);
  });

  it('Send back needs a reason', async () => {
    await expect(repo.sendBackNoc(ctx('manager'), OWN, '   ')).rejects.toThrow('reason_required');
    expect(calls).toHaveLength(0);
  });

  it('Send back stores the reason', async () => {
    results = [[signedRow], [{ ...signedRow, sentBackAt: new Date(), sentBackBy: 'user-intern', sentBackReason: 'No seal' }], []];
    const s = await repo.sendBackNoc(ctx('intern'), OWN, 'No seal');
    expect(calls.find((c) => c.op === 'update')?.set).toMatchObject({ sentBackReason: 'No seal', sentBackBy: 'user-intern' });
    expect(s.sentBack?.reason).toBe('No seal');
  });

  it('a check that does not apply to an Indian parent is refused', async () => {
    results = [[signedRow]];
    await expect(repo.setNocCheck(ctx('intern'), OWN, 'notary_stamp', true)).rejects.toThrow('unknown_check');
  });

  it('nothing is received before a signed copy exists', async () => {
    results = [[{ ...signedRow, signedStoragePath: null }]];
    await expect(repo.setNocCheck(ctx('intern'), OWN, 'letterhead', true)).rejects.toThrow('no_signed_copy');
  });

  it('Change template needs a known variant and a reason', async () => {
    await expect(repo.changeNocTemplate(ctx('manager'), OWN, 'nope', 'r')).rejects.toThrow('unknown_variant');
    await expect(repo.changeNocTemplate(ctx('manager'), OWN, 'indian-name-only', ' ')).rejects.toThrow('reason_required');
  });
});
