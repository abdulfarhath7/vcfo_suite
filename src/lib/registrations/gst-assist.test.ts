import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthContext } from '@/auth/guards';
import type { Engagement } from '@/data/engagements';
import type { DocPackAccess } from '@/db/repositories/doc-pack';
import { director, fullState } from '@/lib/doc-pack/__tests__/fixtures';
import type { EngagementChecklistState } from '@/lib/projects/engagements-db';

/**
 * Route-level proof of the GST REG-01 profile endpoint and the result post-back: who may read,
 * who may record, what is written into the reg-4 tracker, and that a repeated post changes
 * nothing. Guards, the doc-pack access read and storage are stubbed with their production shape
 * (as in `src/lib/api/assist-profile.test.ts`); the database answers from a table-keyed stub.
 */

vi.mock('server-only', () => ({}));

let role: AuthContext['role'] = 'intern';
let internId = 'lead-1';
let visible = true;

vi.mock('@/auth/guards', () => ({
  requireAnyRole: async (...roles: string[]) => {
    const ctx: AuthContext = { userId: 'u-1', email: `${role}@vcfo.local`, name: role, role, internId };
    if (roles.includes(role) || (role === 'super_admin' && roles.includes('admin'))) return { ok: true, ctx };
    return { ok: false, status: 403, error: `Requires one of: ${roles.join(', ')}` };
  },
}));

const ENGAGEMENT: Engagement = {
  id: 'eng-1',
  slug: 'test-company',
  clientId: 'client-1',
  companyName: 'Test Company Private Limited',
  companyType: 'domestic',
  entityLegalForm: 'company',
  internId: 'lead-1',
  adminId: 'admin-1',
  managerId: 'mgr-1',
  createdAt: '2026-11-01T00:00:00.000Z',
  stage: 'Post-Incorporation',
  health: 'on-track',
};

const STATE: EngagementChecklistState = {
  ...fullState([director('d1', 'yes', 'Asha', { gender: 'female', recentPhotographUrl: 'eng-1/recentPhotographUrl/1700000000000-asha.jpg' })]),
  'pre-12': { status: 'completed', responses: { pan: 'AAATC1234X', cin: 'U62099KA2026PTC000001', dateOfIncorporation: '2026-11-02', certificateOfIncorporationFinalUrl: 'eng-1/certificateOfIncorporationFinalUrl/1700000000001-coi.pdf' } },
} as EngagementChecklistState;

vi.mock('@/db/repositories/doc-pack', () => ({
  getDocPackInputs: async (ctx: AuthContext): Promise<DocPackAccess> => {
    if (ctx.role === 'client') return { ok: false, status: 403, error: 'forbidden' };
    if (!visible) return { ok: false, status: 404, error: 'not_found' };
    if (ctx.role === 'intern' && ctx.internId !== 'lead-1') return { ok: false, status: 403, error: 'forbidden' };
    return { ok: true, inputs: { dbId: '11111111-1111-4111-8111-111111111111', engagement: ENGAGEMENT, checklistState: STATE, brRow: null } };
  },
}));

// The database: rows by table, read through any chain of builder calls.
let tracker: Array<{ side: string; key: string; value: string | null }> = [];
vi.mock('@/db/client', async () => {
  const schema = await import('@/db/schema');
  const rowsFor = (table: unknown) => (table === schema.complianceSubjectFields ? tracker : []);
  const chain = (table: unknown): unknown =>
    new Proxy(() => undefined, {
      get(_t, prop) {
        if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(rowsFor(table));
        return (...args: unknown[]) => chain(prop === 'from' ? args[0] : table);
      },
    });
  return { db: { select: () => chain(null) } };
});

vi.mock('@/storage/s3', () => ({
  signedDownloadUrl: async (key: string) => `https://signed.test/${key}`,
  bucketKey: (bucket: string, path: string) => `${bucket}/${path.replace(/^\/+/, '')}`,
}));

const saveSubjectFields = vi.fn(async () => true);
class InputsForbiddenError extends Error {}
vi.mock('@/db/repositories/compliance-inputs', () => ({ saveSubjectFields: (...a: unknown[]) => (saveSubjectFields as (...x: unknown[]) => unknown)(...a), InputsForbiddenError }));
const recordAuditEvent = vi.fn(async () => undefined);
vi.mock('@/db/repositories/audit-events', () => ({ recordAuditEvent: (...a: unknown[]) => (recordAuditEvent as (...x: unknown[]) => unknown)(...a) }));
vi.mock('@/lib/assist-runs/runs', () => ({ assistSetUp: () => true }));
const handleAssistIngest = vi.fn(async () => new Response(JSON.stringify({ ok: true, mca: true })));
vi.mock('@/lib/assist-runs/ingest-route', () => ({ handleAssistIngest: (...a: unknown[]) => (handleAssistIngest as (...x: unknown[]) => unknown)(...a) }));
vi.mock('@/lib/api/assist-profile', () => ({ loadAssistProfile: async () => ({ ok: true, load: { result: { schemaVersion: 1, companyName: 'x', profile: {}, missing: [], notes: [] } } }) }));

const profileRoute = await import('@/../app/api/engagements/[id]/assist-profile/route');
const resultRoute = await import('@/../app/api/assist/engagements/[id]/result/route');

const params = () => ({ params: Promise.resolve({ id: 'eng-1' }) });
const get = (q = '?form=gst-reg-01') => profileRoute.GET(new Request(`http://localhost/api/engagements/eng-1/assist-profile${q}`), params());
const post = (body: unknown) =>
  resultRoute.POST(new Request('http://localhost/api/assist/engagements/eng-1/result', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }), params());

beforeEach(() => {
  role = 'intern';
  internId = 'lead-1';
  visible = true;
  tracker = [];
  vi.clearAllMocks();
});

describe('GET assist-profile?form=gst-reg-01', () => {
  it('answers the GST profile with signed document URLs and no storage keys', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toMatch(/no-store/);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, form: 'gst-reg-01', schemaVersion: 1, engagement: { slug: 'test-company' } });
    expect(body.fields['partA.pan']).toBe('AAATC1234X');
    expect(body.documents.length).toBeGreaterThan(0);
    for (const d of body.documents) {
      expect(d.url).toMatch(/^https:\/\/signed\.test\//);
      expect(d).not.toHaveProperty('storageKey');
    }
    expect(body.readiness.ready).toBe(false);
  });

  it('keeps the MCA profile without the form parameter', async () => {
    const body = await (await get('')).json();
    expect(body).not.toHaveProperty('form');
  });

  it('refuses a client, a lead of another engagement and an unknown engagement', async () => {
    role = 'client';
    expect((await get()).status).toBe(403);
    role = 'intern';
    internId = 'lead-2';
    expect((await get()).status).toBe(403);
    internId = 'lead-1';
    visible = false;
    expect((await get()).status).toBe(404);
  });

  it('lets a manager and an admin read', async () => {
    role = 'manager';
    expect((await get()).status).toBe(200);
    role = 'super_admin';
    expect((await get()).status).toBe(200);
  });
});

describe('POST result with form gst-reg-01', () => {
  it('records the ARN, its date and the filing day in the reg-4 tracker, with an audit row', async () => {
    const res = await post({ form: 'gst-reg-01', arn: 'aa291126012345a', arnDate: '29/11/2026', status: 'submitted', fieldsWritten: 61 });
    expect(res.status).toBe(200);
    expect(saveSubjectFields).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'intern' }),
      { engagementId: 'eng-1', kind: 'registration', key: 'reg-4', side: 'sbc', values: { arn: 'AA291126012345A', 'arn-date': '2026-11-29', 'filed-on': '2026-11-29' } },
    );
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'registration.gst.assist_result' }));
    expect(handleAssistIngest).not.toHaveBeenCalled();
  });

  it('changes nothing on a repeated post', async () => {
    tracker = [
      { side: 'sbc', key: 'arn', value: 'AA291126012345A' },
      { side: 'sbc', key: 'arn-date', value: '2026-11-29' },
      { side: 'sbc', key: 'filed-on', value: '2026-11-29' },
    ];
    const body = await (await post({ form: 'gst-reg-01', arn: 'AA291126012345A' })).json();
    expect(body.changed).toEqual([]);
    expect(saveSubjectFields).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it('records the SRN and then the GSTIN with the outcome, keeping the ARN', async () => {
    tracker = [{ side: 'sbc', key: 'arn', value: 'AA291126012345A' }];
    await post({ form: 'gst-reg-01', srn: 'SRN-0001234' });
    expect(saveSubjectFields).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ values: { srn: 'SRN-0001234' } }));
    await post({ form: 'gst-reg-01', gstin: '29AAATC1234X1Z5', registeredOn: '30/11/2026' });
    expect(saveSubjectFields).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ values: { number: '29AAATC1234X1Z5', outcome: 'approved', 'registered-on': '2026-11-30' } }));
  });

  it('refuses a GSTIN of another PAN, a second ARN and bad formats', async () => {
    expect((await post({ form: 'gst-reg-01', gstin: '29ZZZZZ9999Z1Z5' })).status).toBe(422);
    tracker = [{ side: 'sbc', key: 'arn', value: 'AA291126000001A' }];
    expect((await post({ form: 'gst-reg-01', arn: 'AA291126012345A' })).status).toBe(409);
    expect((await post({ form: 'gst-reg-01', arn: 'ARN123' })).status).toBe(400);
    expect((await post({ form: 'gst-reg-01' })).status).toBe(400);
    expect(saveSubjectFields).not.toHaveBeenCalled();
  });

  it('lets only the project lead record (owner rule), and never a client', async () => {
    role = 'manager';
    expect((await post({ form: 'gst-reg-01', arn: 'AA291126012345A' })).status).toBe(403);
    role = 'admin';
    expect(await (await post({ form: 'gst-reg-01', arn: 'AA291126012345A' })).json()).toMatchObject({ error: 'tracker_lead_only' });
    role = 'client';
    expect((await post({ form: 'gst-reg-01', arn: 'AA291126012345A' })).status).toBe(403);
    role = 'intern';
    internId = 'lead-2';
    expect((await post({ form: 'gst-reg-01', arn: 'AA291126012345A' })).status).toBe(403);
    expect(saveSubjectFields).not.toHaveBeenCalled();
  });

  it('takes the extension post as sent: the ARN copied into srn and reference, the subject, 17 characters', async () => {
    await post({ form: 'gst-reg-01', arn: 'AA2911260123456', srn: 'AA2911260123456', reference: 'AA2911260123456', arnDate: '29/11/2026', subjectKind: 'registration', subjectKey: 'reg-4', mismatches: [{ field: 'partA.email' }] });
    expect(saveSubjectFields).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ values: { arn: 'AA2911260123456', 'arn-date': '2026-11-29', 'filed-on': '2026-11-29' } }));
    saveSubjectFields.mockClear();
    tracker = [];
    expect((await post({ form: 'gst-reg-01', arn: 'AA29291126012345A' })).status).toBe(200);
    expect((await post({ form: 'gst-reg-01', arn: 'AA2911260123456', subjectKey: 'reg-5' })).status).toBe(400);
  });

  it('passes an MCA result through to the Assist run ingest', async () => {
    await post({ form: 'spice-part-a', srn: 'AB1234567' });
    expect(handleAssistIngest).toHaveBeenCalledTimes(1);
  });
});
