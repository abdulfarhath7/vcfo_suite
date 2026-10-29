import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const requireDeveloper = vi.fn();
const requireAuth = vi.fn();
const recordAuditEvent = vi.fn();

vi.mock('@/auth/guards', () => ({ requireDeveloper: () => requireDeveloper(), requireAuth: () => requireAuth() }));
vi.mock('@/db/repositories/audit-events', () => ({ recordAuditEvent: (...a: unknown[]) => recordAuditEvent(...a) }));

import { devAction } from './route-helpers';

const dev = { userId: 'u1', email: 'd@x.in', name: 'Dev', role: 'developer' };
const post = (body: unknown) => new Request('http://x/api/dev/jobs/retry', { method: 'POST', body: JSON.stringify(body) });

describe('devAction (console writes, R-40)', () => {
  beforeEach(() => {
    requireDeveloper.mockReset();
    requireAuth.mockReset();
    recordAuditEvent.mockReset();
  });

  it('refuses a signed-in non-developer with 403, writes a denied row and never runs the handler', async () => {
    requireDeveloper.mockResolvedValue({ ok: false, status: 403, error: 'Requires developer role' });
    requireAuth.mockResolvedValue({ ok: true, ctx: { ...dev, role: 'manager' } });
    const handler = vi.fn();
    const res = await devAction(post({}), z.object({}), handler);
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'manager' }),
      expect.objectContaining({ action: 'dev.action.denied', result: 'denied' }),
    );
  });

  it('answers 401 without an audit row when nobody is signed in', async () => {
    requireDeveloper.mockResolvedValue({ ok: false, status: 401, error: 'Not authenticated' });
    const res = await devAction(post({}), z.object({}), vi.fn());
    expect(res.status).toBe(401);
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it('checks the body and passes the developer context to the handler', async () => {
    requireDeveloper.mockResolvedValue({ ok: true, ctx: dev });
    const handler = vi.fn().mockResolvedValue({ status: 200, body: { ok: true } });
    const bad = await devAction(post({ runId: 5 }), z.object({ runId: z.string() }), handler);
    expect(bad.status).toBe(400);
    const good = await devAction(post({ runId: 'r1' }), z.object({ runId: z.string() }), handler);
    expect(good.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(dev, { runId: 'r1' });
  });
});
