import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';

/**
 * DR-03 through the GL-07 reminder route: `purpose: 'step-opened'` drafts the "Proposed directors
 * is open" email (only on that step), and every step email is filed under the step id so the step
 * page and the step cards show who sent it.
 */

const target = {
  engagementDbId: 'db-1',
  engagementId: 'db-1',
  companyName: 'Ember Technologies Private Limited',
  itemKey: 'step:db-1:pre-15',
  itemTitle: 'Proposed directors',
  clientPath: '/app/client/incorporation?step=pre-15',
  kind: 'step' as const,
};

const resolveReminderTarget = vi.fn();
vi.mock('@/db/repositories/client-reminders', () => ({
  lastReminderWithinWindow: vi.fn(async () => null),
  recordReminderDeliveries: vi.fn(async () => {}),
  REMINDER_AUDIT_ACTION: 'reminder.client',
  REMINDER_WINDOW_MS: 86_400_000,
  resolveReminderTarget: (...a: unknown[]) => resolveReminderTarget(...a),
}));
vi.mock('@/db/repositories/engagement-recipients', () => ({
  resolveEngagementRecipients: vi.fn(async () => ({ clients: [{ userId: 'c1', email: 'client@ember.in', name: 'Ravi Kumar' }], client: null })),
}));
vi.mock('@/db/repositories/audit-events', () => ({ recordAuditEvent: vi.fn(async () => {}) }));
const sendEmail = vi.fn();
vi.mock('@/lib/email/send-email', () => ({
  sendEmail: (...a: unknown[]) => sendEmail(...a),
  formatReplyTo: () => 'Asha <asha@sbc.example>',
}));
const recordEmailSent = vi.fn();
vi.mock('@/lib/email/record-email-sent', () => ({ recordEmailSent: (...a: unknown[]) => recordEmailSent(...a) }));
vi.mock('@/lib/notify/send-whatsapp', () => ({ queueWhatsAppSends: vi.fn(async () => {}) }));
vi.mock('@/lib/notify/templates', () => ({ firstNameOf: (n: string) => n.split(' ')[0] }));

const { previewClientReminder, sendClientReminder } = await import('@/lib/reminders/send-client-reminder');

const ctx: AuthContext = { userId: 'lead-1', email: 'asha@sbc.example', name: 'Asha Rao', role: 'intern' };

beforeEach(() => {
  vi.clearAllMocks();
  resolveReminderTarget.mockResolvedValue({ ok: true, target });
  sendEmail.mockResolvedValue({ ok: true, providerMessageId: 'm1' });
});

describe('the step-opened email', () => {
  it('drafts the DR-03 words with a link to the step', async () => {
    const res = await previewClientReminder(ctx, 'db-1', { itemKey: target.itemKey, purpose: 'step-opened' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.draft.to).toEqual(['client@ember.in']);
    expect(res.draft.subject).toBe('Ember Technologies Private Limited: Proposed directors is open');
    expect(res.draft.message).toContain('Please fill the details of each proposed director.');
  });

  it('is refused on a step that has no opening email', async () => {
    resolveReminderTarget.mockResolvedValue({ ok: true, target: { ...target, itemKey: 'step:db-1:pre-4', itemTitle: 'Name' } });
    const res = await previewClientReminder(ctx, 'db-1', { itemKey: 'step:db-1:pre-4', purpose: 'step-opened' });
    expect(res).toEqual(expect.objectContaining({ ok: false, status: 400 }));
  });

  it('sends the edited email and records it under the step id', async () => {
    const res = await sendClientReminder(ctx, 'db-1', { itemKey: target.itemKey, purpose: 'step-opened' }, new Date(), {
      to: ['client@ember.in'],
      cc: [],
      subject: 'Edited subject',
      message: 'Edited words',
      dropAttachments: [],
      addAttachments: [],
    });
    expect(res.ok).toBe(true);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ subject: 'Edited subject' }));
    expect(recordEmailSent).toHaveBeenCalledWith(ctx, expect.objectContaining({ itemId: 'pre-15', subject: 'Edited subject', to: ['client@ember.in'] }));
  });

  it('keeps the plain reminder when no purpose is given', async () => {
    const res = await previewClientReminder(ctx, 'db-1', { itemKey: target.itemKey });
    expect(res.ok && res.draft.subject).toBe('Ember Technologies Private Limited: reminder · Proposed directors');
  });
});
