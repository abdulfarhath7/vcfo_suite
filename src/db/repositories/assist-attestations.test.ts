import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';

/**
 * The certifier's checks (SAFETY.md G17): staff only, reached through the run's engagement, one per
 * run, only on an open, filled run, every check the form needs, evidence from the same engagement,
 * and the certifier rule from the firm setting (same user allowed by default).
 */

type Call = { op: string; values?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    where: () => c,
    limit: () => c,
    innerJoin: () => c,
    leftJoin: () => c,
    orderBy: () => c,
    returning: () => c,
    onConflictDoNothing: () => c,
    set: () => c,
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
vi.mock('@/db/client', () => ({ db: { select: op('select'), insert: op('insert'), update: op('update'), delete: op('delete') } }));

const assertEngagementAccess = vi.fn();
vi.mock('@/db/repositories/engagements', () => ({
  assertEngagementAccess: (...a: unknown[]) => assertEngagementAccess(...a),
  listScopedEngagementIds: vi.fn(async () => []),
}));
const mustDiffer = vi.fn(async () => false);
vi.mock('@/db/repositories/firm-settings', () => ({ systemGetAssistCertifierMustDiffer: () => mustDiffer() }));

const { recordAttestation } = await import('@/db/repositories/assist-attestations');

const OWN = '11111111-1111-1111-1111-111111111101';
const OTHER = '22222222-2222-2222-2222-222222222202';
const RUN = '33333333-3333-3333-3333-333333333303';
const DOC = '44444444-4444-4444-4444-444444444404';

const ctx = (role: AuthContext['role'], userId = `user-${role}`): AuthContext => ({ userId, email: `${role}@vcfo.local`, name: role, role });
const runRow = (engagementId: string, over: Record<string, unknown> = {}) => ({
  id: RUN,
  engagementId,
  userId: 'user-intern',
  subAgent: 'spice-a',
  status: 'waiting_user',
  state: 'WAIT_SUBMIT_PAY',
  clientIps: [],
  ...over,
});
const savedRow = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  runId: RUN,
  engagementId: OWN,
  certifierId: 'user-intern',
  certifierName: 'intern',
  certifierEmail: 'intern@vcfo.local',
  checks: { fieldsCheckedAgainstRecords: true },
  evidenceDocumentIds: [],
  note: null,
  ip: '1.2.3.4',
  createdAt: new Date(),
  ...over,
});
const allow = (dbId: string) => ({ ok: true, dbId, row: { id: dbId, companyName: 'Acme' } });
const deny = (dbId: string) => ({ ok: false, dbId, forbidden: true });
const inserts = () => calls.filter((c) => c.op === 'insert');
const FIELDS = { checks: { fieldsCheckedAgainstRecords: true as const }, evidenceDocumentIds: [] };

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  results = [];
  mustDiffer.mockResolvedValue(false);
  assertEngagementAccess.mockImplementation(async (_c: AuthContext, id: string) => (id === OTHER ? deny(OTHER) : allow(OWN)));
});

describe('recordAttestation', () => {
  it.each(['client', 'developer', 'partner'] as const)('%s is refused before any query', async (role) => {
    await expect(recordAttestation(ctx(role), OWN, RUN, FIELDS)).rejects.toMatchObject({ status: 403 });
    expect(calls).toHaveLength(0);
  });

  it.each(['manager', 'intern'] as const)('%s cannot attest a run on an engagement out of scope', async (role) => {
    results = [[runRow(OTHER)]];
    await expect(recordAttestation(ctx(role), OTHER, RUN, FIELDS)).rejects.toMatchObject({ status: 404, message: 'not_found' });
    expect(inserts()).toHaveLength(0);
  });

  it('refuses a run named under another engagement’s URL', async () => {
    results = [[runRow(OWN)]];
    assertEngagementAccess.mockImplementation(async (_c: AuthContext, id: string) => (id === OWN ? allow(OWN) : allow('55555555-5555-5555-5555-555555555505')));
    await expect(recordAttestation(ctx('admin'), 'elsewhere', RUN, FIELDS)).rejects.toMatchObject({ status: 404 });
    expect(inserts()).toHaveLength(0);
  });

  it('refuses a closed run and a run that is not filled yet', async () => {
    results = [[runRow(OWN, { status: 'done' })]];
    await expect(recordAttestation(ctx('intern'), OWN, RUN, FIELDS)).rejects.toMatchObject({ message: 'run_closed' });
    results = [[runRow(OWN, { state: 'FILL', status: 'running' })]];
    await expect(recordAttestation(ctx('intern'), OWN, RUN, FIELDS)).rejects.toMatchObject({ message: 'run_not_filled' });
    expect(inserts()).toHaveLength(0);
  });

  it('a Part B run needs the office and the subscriber checks', async () => {
    results = [[runRow(OWN, { subAgent: 'spice-b' })]];
    await expect(recordAttestation(ctx('intern'), OWN, RUN, FIELDS)).rejects.toMatchObject({ status: 400, message: 'attestation_incomplete' });
    expect(inserts()).toHaveLength(0);
  });

  it('by default the filer may certify, and the record names the certifier from the session', async () => {
    results = [[runRow(OWN)], [], [savedRow()]];
    const saved = await recordAttestation(ctx('intern'), OWN, RUN, FIELDS, { ip: '1.2.3.4', forwardedFor: '9.9.9.9, 1.2.3.4', userAgent: 'UA' });
    expect(saved.certifierName).toBe('intern');
    expect(inserts()[0]!.values).toMatchObject({
      runId: RUN,
      engagementId: OWN,
      certifierId: 'user-intern',
      checks: { fieldsCheckedAgainstRecords: true },
      ip: '1.2.3.4',
      forwardedFor: '9.9.9.9, 1.2.3.4',
    });
  });

  it('with the firm setting on, the filer cannot certify their own run; another staff member can', async () => {
    mustDiffer.mockResolvedValue(true);
    results = [[runRow(OWN)]];
    await expect(recordAttestation(ctx('intern', 'user-intern'), OWN, RUN, FIELDS)).rejects.toMatchObject({ status: 403, message: 'certifier_must_differ' });
    expect(inserts()).toHaveLength(0);
    results = [[runRow(OWN)], [], [savedRow({ certifierId: 'user-manager' })]];
    await recordAttestation(ctx('manager'), OWN, RUN, FIELDS);
    expect(inserts()[0]!.values).toMatchObject({ certifierId: 'user-manager' });
  });

  it('refuses evidence documents that are not this engagement’s', async () => {
    results = [[runRow(OWN)], []];
    await expect(recordAttestation(ctx('intern'), OWN, RUN, { ...FIELDS, evidenceDocumentIds: [DOC] })).rejects.toMatchObject({ message: 'unknown_document' });
    expect(inserts()).toHaveLength(0);
  });

  it('one attestation per run', async () => {
    results = [[runRow(OWN)], [{ id: 'a0' }]];
    await expect(recordAttestation(ctx('intern'), OWN, RUN, FIELDS)).rejects.toMatchObject({ status: 409, message: 'already_attested' });
    expect(inserts()).toHaveLength(0);
    // A racing second insert that hits the unique index gets the same answer.
    results = [[runRow(OWN)], [], []];
    await expect(recordAttestation(ctx('intern'), OWN, RUN, FIELDS)).rejects.toMatchObject({ message: 'already_attested' });
  });

  it('drops Part B choices sent for a Part A run', async () => {
    results = [[runRow(OWN)], [], [savedRow()]];
    await recordAttestation(ctx('intern'), OWN, RUN, { checks: { fieldsCheckedAgainstRecords: true, registeredOffice: 'visited' }, evidenceDocumentIds: [] });
    expect(inserts()[0]!.values).toMatchObject({ checks: { fieldsCheckedAgainstRecords: true } });
    expect((inserts()[0]!.values as { checks: object }).checks).not.toHaveProperty('registeredOffice');
  });
});
