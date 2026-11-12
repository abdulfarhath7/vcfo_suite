import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * GL-07, owner decision "WhatsApp goes out only after the email". A step event (Deliver, the
 * certificate's Accept) queues no WhatsApp; it puts the nudge on the client email draft. The
 * "Send email" pop-up's route queues one nudge once that email has gone, and a WhatsApp failure
 * never changes the email's answer.
 */

const pending: Array<() => unknown> = [];
vi.mock('server-only', () => ({}));
vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server');
  return { ...actual, after: (fn: () => unknown) => void pending.push(fn) };
});

const client = { userId: 'client-1', email: 'kiran@acme.in', name: 'Kiran Rao' };
const recipients = {
  dbId: 'db-1',
  appId: 'eng-1',
  slug: 'acme',
  companyName: 'Acme Pvt Ltd',
  client,
  clients: [client],
  lead: { userId: 'lead-1', email: 'lead@sbc.in', name: 'Lena Lead' },
  leads: [{ userId: 'lead-1', email: 'lead@sbc.in', name: 'Lena Lead' }],
  manager: { userId: 'mgr-1', email: 'mgr@sbc.in', name: 'Mira Manager' },
  managers: [{ userId: 'mgr-1', email: 'mgr@sbc.in', name: 'Mira Manager' }],
  admins: [],
  progressCc: [],
};

vi.mock('@/db/repositories/engagement-recipients', () => ({ resolveEngagementRecipients: vi.fn(async () => recipients) }));
vi.mock('@/db/repositories/notifications', () => ({ createNotificationsForUsers: vi.fn(async () => undefined) }));
vi.mock('@/db/repositories/outlook-connections', () => ({ sendMailViaOutlook: vi.fn(), getOutlookStatus: vi.fn() }));
vi.mock('@/db/repositories/engagements', () => ({ assertEngagementAccess: vi.fn(async () => ({ ok: true, dbId: 'db-1' })) }));
const sendEmail = vi.fn(async () => ({ ok: true, id: 'm1' }));
vi.mock('@/lib/email/send-email', async () => {
  const shared = await vi.importActual<typeof import('@/lib/email/send-email-shared')>('@/lib/email/send-email-shared');
  return { ...shared, sendEmail: (...a: unknown[]) => sendEmail(...(a as [])) };
});
const recordEmailSent = vi.fn(async () => undefined);
vi.mock('@/lib/email/record-email-sent', () => ({ recordEmailSent: (...a: unknown[]) => recordEmailSent(...(a as [])) }));
const queueWhatsAppSends = vi.fn(async () => undefined);
vi.mock('@/lib/notify/send-whatsapp', () => ({ queueWhatsAppSends: (...a: unknown[]) => queueWhatsAppSends(...(a as [])) }));
const ctx = { userId: 'lead-1', role: 'intern', name: 'Lena Lead', email: 'lead@sbc.in' };
vi.mock('@/auth/guards', () => ({ requireAnyRole: vi.fn(async () => ({ ok: true, ctx })) }));

const { notifyEngagementEvent } = await import('@/lib/email/notify-engagement-event');
const { POST } = await import('../../../app/api/email/send-draft/route');

function sendDraft(body: Record<string, unknown>) {
  return POST(new Request('http://localhost/api/email/send-draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: [client.email], subject: 'Documents delivered', text: 'Hello', ...body }),
  }));
}

async function runAfter() {
  for (const fn of pending.splice(0)) await fn();
}

beforeEach(() => {
  pending.length = 0;
  vi.clearAllMocks();
});

describe('step event', () => {
  it('Deliver queues no WhatsApp and puts the nudge on the client draft', async () => {
    const email = await notifyEngagementEvent({ engagementId: 'eng-1', itemId: 'pre-4', event: 'delivered', actorUserId: 'lead-1' });
    expect(queueWhatsAppSends).not.toHaveBeenCalled();
    expect(email.outgoingDraft).toMatchObject({ to: [client.email], whatsappEvent: 'document_delivered' });
  });

  it('accepting the certificate step carries coi_issued; another step carries nothing', async () => {
    const coi = await notifyEngagementEvent({ engagementId: 'eng-1', itemId: 'pre-12', event: 'review_accepted', actorUserId: 'mgr-1' });
    expect(coi.outgoingDraft?.whatsappEvent).toBe('coi_issued');
    const other = await notifyEngagementEvent({ engagementId: 'eng-1', itemId: 'pre-4', event: 'review_accepted', actorUserId: 'mgr-1' });
    expect(other.outgoingDraft).toBeTruthy();
    expect(other.outgoingDraft?.whatsappEvent).toBeUndefined();
    expect(queueWhatsAppSends).not.toHaveBeenCalled();
  });

  it('a re-deliver (in-app only) carries no nudge', async () => {
    const email = await notifyEngagementEvent({ engagementId: 'eng-1', itemId: 'pre-4', event: 'delivered', inAppOnly: true });
    expect(email.outgoingDraft).toBeUndefined();
    expect(queueWhatsAppSends).not.toHaveBeenCalled();
  });
});

describe('Send of the drafted email', () => {
  it('queues exactly one WhatsApp, after the email, with the event variables', async () => {
    const res = await sendDraft({ engagementId: 'eng-1', itemId: 'pre-4', whatsappEvent: 'document_delivered' });
    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(queueWhatsAppSends).not.toHaveBeenCalled();
    await runAfter();
    expect(queueWhatsAppSends).toHaveBeenCalledTimes(1);
    const [inputs] = queueWhatsAppSends.mock.calls[0] as unknown as [Array<Record<string, unknown>>];
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toMatchObject({
      engagementId: 'eng-1',
      recipientProfileId: 'client-1',
      event: 'document_delivered',
      variables: { firstName: 'Kiran', companyName: 'Acme Pvt Ltd' },
      dedupeId: 'step-email:document_delivered:db-1:pre-4:client-1',
    });
  });

  it('queues nothing for a draft without a nudge, a failed email, or a client left off the email', async () => {
    await sendDraft({ engagementId: 'eng-1', itemId: 'pre-4' });
    await runAfter();
    await sendDraft({ engagementId: 'eng-1', itemId: 'pre-4', whatsappEvent: 'document_delivered', to: ['someone@else.in'] });
    await runAfter();
    // coi_issued is accepted only on the certificate step.
    await sendDraft({ engagementId: 'eng-1', itemId: 'pre-4', whatsappEvent: 'coi_issued' });
    await runAfter();
    sendEmail.mockResolvedValueOnce({ ok: false, error: 'send_failed' } as never);
    const failed = await sendDraft({ engagementId: 'eng-1', itemId: 'pre-4', whatsappEvent: 'document_delivered' });
    expect(failed.status).toBe(502);
    await runAfter();
    expect(queueWhatsAppSends).not.toHaveBeenCalled();
  });

  it('a WhatsApp failure leaves the email answer untouched', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    queueWhatsAppSends.mockRejectedValueOnce(new Error('queue down'));
    const res = await sendDraft({ engagementId: 'eng-1', itemId: 'pre-12', whatsappEvent: 'coi_issued' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, sent: [client.email] });
    await expect(runAfter()).resolves.toBeUndefined();
    expect(queueWhatsAppSends).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
