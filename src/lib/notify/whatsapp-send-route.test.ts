import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ guard: vi.fn(), scope: vi.fn(), recipient: vi.fn(), send: vi.fn(), record: vi.fn() }));
vi.mock('@/auth/guards', () => ({ requireAnyRole: () => mocks.guard() }));
vi.mock('@/db/repositories/whatsapp-recipients', () => ({ getWhatsAppRecipientInScope: (...a: unknown[]) => mocks.scope(...a) }));
vi.mock('@/db/repositories/profiles', () => ({ systemGetNotifyRecipient: (...a: unknown[]) => mocks.recipient(...a) }));
vi.mock('@/db/repositories/notification-deliveries', () => ({ systemRecordDelivery: (...a: unknown[]) => mocks.record(...a) }));
vi.mock('@/lib/notify/send-whatsapp', () => ({ sendWhatsAppTemplate: (...a: unknown[]) => mocks.send(...a) }));

const { POST } = await import('../../../app/api/whatsapp/send/route');

const RID = '6f1d1c2e-1b5a-4c33-9a0e-7d1b2c3d4e5f';
let n = 0;
const call = (body: Record<string, unknown>) =>
  POST(new Request('http://localhost/api/whatsapp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
const ok = { recipientId: RID, event: 'coi_issued', variables: { companyName: 'Acme' } };

beforeEach(() => {
  n += 1;
  mocks.guard.mockReset().mockResolvedValue({ ok: true, ctx: { userId: `mgr-${n}`, role: 'manager' } });
  mocks.scope.mockReset().mockResolvedValue({ userId: RID, name: 'Mei', projects: [{ id: 'eng-1', slug: 'acme', companyName: 'Acme' }] });
  mocks.recipient
    .mockReset()
    .mockResolvedValue({ profileId: RID, name: 'Mei', email: 'm@x.in', phoneE164: '+919876543210', whatsappOptInAt: new Date(), whatsappOptOutAt: null });
  mocks.send.mockReset().mockResolvedValue({ ok: false, status: 'skipped', skipReason: 'disabled' });
  mocks.record.mockReset().mockResolvedValue(null);
});

describe('POST /api/whatsapp/send', () => {
  it('refuses someone outside the sender scope and sends nothing', async () => {
    mocks.scope.mockResolvedValue(null);
    const res = await call(ok);
    expect(res.status).toBe(403);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('refuses a missing template field', async () => {
    const res = await call({ ...ok, variables: {} });
    expect(res.status).toBe(400);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('refuses a person without consent before calling WhatsApp', async () => {
    mocks.recipient.mockResolvedValue({ profileId: RID, name: 'Mei', email: 'm@x.in', phoneE164: '+919876543210', whatsappOptInAt: null, whatsappOptOutAt: null });
    const res = await call(ok);
    expect(res.status).toBe(409);
    expect((await res.json()).reason).toBe('no_consent');
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('sends through the dispatcher and records the outcome on the engagement, with the variables', async () => {
    const res = await call(ok);
    expect(await res.json()).toMatchObject({ ok: false, status: 'skipped', reason: 'disabled' });
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ event: 'coi_issued', variables: { companyName: 'Acme' } }));
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({ engagementId: 'eng-1', channel: 'whatsapp', status: 'skipped', skipReason: 'disabled', variables: { companyName: 'Acme' } }),
    );
  });
  it('blocks a quick second send to the same person', async () => {
    await call(ok);
    const res = await call(ok);
    expect(res.status).toBe(429);
  });
});
