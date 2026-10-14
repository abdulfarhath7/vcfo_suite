import { describe, expect, it } from 'vitest';
import { whatsappDedupeId, whatsappEventFor } from '@/lib/notify/process-event-whatsapp';

const base = { itemId: 'pre-4' };

describe('whatsappEventFor', () => {
  it.each([
    ['step_awaiting_client_approval', 'step_awaiting_approval'],
    ['phase_approved', 'phase_approved'],
    ['client_fill_approved', 'client_action_needed'],
    ['docs_shared', 'documents_shared'],
    ['client_submitted', 'staff_client_submitted'],
    ['client_uploaded', 'staff_client_uploaded'],
    ['client_change_requested', 'staff_change_requested'],
    ['delivered', 'document_delivered'],
  ] as const)('maps %s to its own template %s with the step title', (event, template) => {
    expect(whatsappEventFor({ ...base, event }, 'Client Details')).toEqual({
      event: template,
      stepTitle: 'Client Details',
    });
  });

  it('sends the certificate notice when the COI step is accepted', () => {
    expect(whatsappEventFor({ event: 'review_accepted', itemId: 'pre-12' }, 'COI')).toEqual({
      event: 'coi_issued',
    });
  });

  it('falls back to the short process notice for every other process email', () => {
    expect(whatsappEventFor({ ...base, event: 'review_rejected' }, 'Client Details')).toEqual({
      event: 'process_notice',
      stepTitle: 'Client Details needs a correction',
    });
    expect(whatsappEventFor({ ...base, event: 'client_fill_requested' }, 'Client Details')?.event).toBe(
      'process_notice',
    );
  });

  it('sends nothing for a portal-only refresh or a re-opened compose', () => {
    expect(whatsappEventFor({ ...base, event: 'delivered', inAppOnly: true }, 'X')).toBeNull();
    expect(
      whatsappEventFor({ ...base, event: 'step_awaiting_client_approval', skipInAppNotifications: true }, 'X'),
    ).toBeNull();
  });
});

describe('whatsappDedupeId', () => {
  const parts = {
    event: 'staff_client_submitted' as const,
    engagementId: 'eng-1',
    itemId: 'pre-4',
    recipientProfileId: 'p-1',
  };

  it('is the same for a repeat on the same day', () => {
    const morning = whatsappDedupeId({ ...parts, at: new Date('2026-10-14T03:00:00Z') });
    const evening = whatsappDedupeId({ ...parts, at: new Date('2026-10-14T20:00:00Z') });
    expect(morning).toBe(evening);
    expect(morning).toBe('wa:staff_client_submitted:eng-1:pre-4:p-1:2026-10-14');
  });

  it('differs by recipient, step and day', () => {
    const at = new Date('2026-10-14T03:00:00Z');
    const id = whatsappDedupeId({ ...parts, at });
    expect(whatsappDedupeId({ ...parts, recipientProfileId: 'p-2', at })).not.toBe(id);
    expect(whatsappDedupeId({ ...parts, itemId: 'pre-5', at })).not.toBe(id);
    expect(whatsappDedupeId({ ...parts, at: new Date('2026-10-15T03:00:00Z') })).not.toBe(id);
  });
});
