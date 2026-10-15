import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  queue: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock('@/db/repositories/engagement-recipients', () => ({
  resolveEngagementRecipients: vi.fn(async () => ({
    dbId: 'db-1',
    appId: 'eng-1',
    slug: 'acme',
    companyName: 'Acme India',
    client: { userId: 'cli-1', email: 'client@acme.in', name: 'Client' },
    clients: [{ userId: 'cli-1', email: 'client@acme.in', name: 'Client' }],
    lead: { userId: 'lead-1', email: 'lead@vcfo.in', name: 'Lead Person' },
    leads: [{ userId: 'lead-1', email: 'lead@vcfo.in', name: 'Lead Person' }],
    manager: { userId: 'mgr-1', email: 'pm@vcfo.in', name: 'Pranay Kumar' },
    managers: [{ userId: 'mgr-1', email: 'pm@vcfo.in', name: 'Pranay Kumar' }],
    admins: [],
    progressCc: [],
  })),
}));
vi.mock('@/db/repositories/notifications', () => ({ createNotificationsForUsers: vi.fn(async () => {}) }));
vi.mock('@/db/repositories/outlook-connections', () => ({ sendMailViaOutlook: vi.fn() }));
vi.mock('@/lib/email/send-email', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email/send-email')>()),
  sendEmail: mocks.sendEmail,
}));
vi.mock('@/lib/notify/queue-mail-handlers', () => ({ queueWhatsAppForMailHandlers: mocks.queue }));

import { notifyEngagementEvent } from '@/lib/email/notify-engagement-event';

beforeEach(() => {
  mocks.queue.mockReset();
  mocks.sendEmail.mockReset().mockResolvedValue({ ok: true });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('notifyEngagementEvent — WhatsApp beside email', () => {
  const input = {
    engagementId: 'eng-1',
    itemId: 'pre-4',
    event: 'client_submitted' as const,
    actorUserId: 'cli-1',
  };

  it('queues the staff template to the people the email went to', async () => {
    mocks.queue.mockResolvedValue(undefined);
    await notifyEngagementEvent(input);

    expect(mocks.queue).toHaveBeenCalledTimes(1);
    const call = mocks.queue.mock.calls[0]![0];
    expect(call.event).toBe('staff_client_submitted');
    expect(call.handlers.map((h: { userId: string }) => h.userId)).toEqual(['lead-1', 'mgr-1']);
    expect(call.dedupeIdFor('mgr-1')).toMatch(/^wa:staff_client_submitted:eng-1:pre-4:mgr-1:\d{4}-\d{2}-\d{2}$/);
  });

  it('returns the same email result when the WhatsApp queue throws', async () => {
    mocks.queue.mockResolvedValue(undefined);
    const healthy = await notifyEngagementEvent(input);

    mocks.queue.mockRejectedValue(new Error('inngest down'));
    const broken = await notifyEngagementEvent(input);

    expect(broken).toEqual(healthy);
    expect(broken.sent).toEqual(['lead@vcfo.in', 'pm@vcfo.in']);
  });
});
