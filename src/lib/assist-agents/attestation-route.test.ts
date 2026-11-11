import { beforeEach, describe, expect, it, vi } from 'vitest';

/** The attestation route: staff guard first, strict body, the repository's errors mapped to codes. */

const requireAnyRole = vi.fn();
vi.mock('@/auth/guards', () => ({ requireAnyRole: (...a: unknown[]) => requireAnyRole(...a) }));
const recordAttestation = vi.fn();
vi.mock('@/db/repositories/assist-attestations', () => ({ recordAttestation: (...a: unknown[]) => recordAttestation(...a) }));

const { AssistAgentAccessError } = await import('@/db/repositories/assist-agent-runs');
const { POST } = await import('../../../app/api/engagements/[id]/assist-runs/[runId]/attestation/route');

const RUN = '33333333-3333-3333-3333-333333333303';
const ctx = { userId: 'u1', email: 'lead@vcfo.local', name: 'Lead', role: 'intern' };
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://app.test/x', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers } });
const params = (runId = RUN) => ({ params: Promise.resolve({ id: 'acme', runId }) });
const GOOD = { checks: { fieldsCheckedAgainstRecords: true } };

beforeEach(() => {
  vi.clearAllMocks();
  requireAnyRole.mockResolvedValue({ ok: true, ctx });
});

describe('POST /api/engagements/[id]/assist-runs/[runId]/attestation', () => {
  it('is staff only and asks the guard for admin, manager and lead', async () => {
    requireAnyRole.mockResolvedValue({ ok: false, status: 403, error: 'forbidden' });
    const res = await POST(post(GOOD), params());
    expect(res.status).toBe(403);
    expect(requireAnyRole).toHaveBeenCalledWith('admin', 'manager', 'intern');
    expect(recordAttestation).not.toHaveBeenCalled();
  });

  it('refuses an unticked field check before the repository', async () => {
    const res = await POST(post({ checks: { fieldsCheckedAgainstRecords: false } }), params());
    expect(res.status).toBe(400);
    expect(recordAttestation).not.toHaveBeenCalled();
  });

  it('a malformed run id is not found', async () => {
    expect((await POST(post(GOOD), params('nope'))).status).toBe(404);
  });

  it('passes the session, the engagement and the client IP (the proxy’s entry) to the repository', async () => {
    recordAttestation.mockResolvedValue({ id: 'a1' });
    const res = await POST(post(GOOD, { 'x-forwarded-for': '6.6.6.6, 1.2.3.4', 'user-agent': 'UA' }), params());
    expect(res.status).toBe(201);
    expect(recordAttestation).toHaveBeenCalledWith(ctx, 'acme', RUN, expect.objectContaining({ evidenceDocumentIds: [] }), {
      ip: '1.2.3.4',
      forwardedFor: '6.6.6.6, 1.2.3.4',
      userAgent: 'UA',
    });
  });

  it.each([
    ['certifier_must_differ', 403],
    ['not_found', 404],
    ['already_attested', 409],
  ] as const)('maps %s to %i', async (code, status) => {
    recordAttestation.mockRejectedValue(new AssistAgentAccessError(code, status));
    const res = await POST(post(GOOD), params());
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ ok: false, error: code });
  });
});
