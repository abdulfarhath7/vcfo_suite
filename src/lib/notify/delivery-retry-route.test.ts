import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  lookup: vi.fn(),
  queue: vi.fn(),
}));

vi.mock('@/auth/guards', () => ({ requireAdminOrManager: () => mocks.guard() }));
vi.mock('@/db/repositories/notification-deliveries', () => ({
  getDeliveryForRetry: (...args: unknown[]) => mocks.lookup(...args),
}));
vi.mock('@/lib/notify/send-whatsapp', () => ({ queueWhatsAppSend: mocks.queue }));

const { POST } = await import(
  '../../../app/api/engagements/[id]/notification-deliveries/[deliveryId]/retry/route'
);

const DELIVERY_ID = '6f1d1c2e-1b5a-4c33-9a0e-7d1b2c3d4e5f';

function call(deliveryId = DELIVERY_ID) {
  return POST(new Request('http://localhost/api'), {
    params: Promise.resolve({ id: 'eng-1', deliveryId }),
  });
}

beforeEach(() => {
  mocks.guard.mockReset().mockResolvedValue({
    ok: true,
    ctx: { userId: 'mgr-1', email: 'pm@vcfo.in', name: 'PM', role: 'manager' },
  });
  mocks.lookup.mockReset();
  mocks.queue.mockReset().mockResolvedValue(undefined);
});

describe('POST …/notification-deliveries/:deliveryId/retry', () => {
  it('refuses a client with 403 and queues nothing', async () => {
    mocks.guard.mockResolvedValue({ ok: false, status: 403, error: 'Requires one of: super_admin, admin, manager' });
    const res = await call();
    expect(res.status).toBe(403);
    expect(mocks.lookup).not.toHaveBeenCalled();
    expect(mocks.queue).not.toHaveBeenCalled();
  });

  it('refuses a row that is not a failed WhatsApp send', async () => {
    mocks.lookup.mockResolvedValue({ ok: false, error: 'not_retryable' });
    const res = await call();
    expect(res.status).toBe(409);
    expect(mocks.queue).not.toHaveBeenCalled();
  });

  it('reads a row outside the caller’s engagements as not found', async () => {
    mocks.lookup.mockResolvedValue({ ok: false, error: 'not_found' });
    expect((await call()).status).toBe(404);
    expect((await call('not-a-uuid')).status).toBe(404);
    expect(mocks.queue).not.toHaveBeenCalled();
  });

  it('queues the same message once, under a new dedupe id', async () => {
    mocks.lookup.mockResolvedValue({
      ok: true,
      delivery: {
        id: DELIVERY_ID,
        engagementId: 'db-eng-1',
        recipientProfileId: 'cli-1',
        event: 'step_awaiting_approval',
        variables: { firstName: 'Asha', companyName: 'Acme', stepTitle: 'Client Details' },
        attempt: 2,
      },
    });

    const res = await call();
    expect(res.status).toBe(202);
    expect(mocks.lookup).toHaveBeenCalledWith(expect.objectContaining({ userId: 'mgr-1' }), 'eng-1', DELIVERY_ID);
    expect(mocks.queue).toHaveBeenCalledTimes(1);
    expect(mocks.queue).toHaveBeenCalledWith({
      engagementId: 'db-eng-1',
      recipientProfileId: 'cli-1',
      event: 'step_awaiting_approval',
      variables: { firstName: 'Asha', companyName: 'Acme', stepTitle: 'Client Details' },
      dedupeId: `retry:${DELIVERY_ID}:2`,
      retryOf: DELIVERY_ID,
    });
  });
});
