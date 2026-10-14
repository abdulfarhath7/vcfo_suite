import { describe, expect, it } from 'vitest';
import { canAdvanceDeliveryStatus, statusesThatMayAdvanceTo } from '@/lib/notify/delivery-status';

describe('canAdvanceDeliveryStatus', () => {
  it('moves forward through queued → sent → delivered → read', () => {
    expect(canAdvanceDeliveryStatus('queued', 'sent')).toBe(true);
    expect(canAdvanceDeliveryStatus('sent', 'delivered')).toBe(true);
    expect(canAdvanceDeliveryStatus('delivered', 'read')).toBe(true);
    expect(canAdvanceDeliveryStatus('queued', 'read')).toBe(true);
  });

  it('refuses a late or duplicate event', () => {
    expect(canAdvanceDeliveryStatus('read', 'delivered')).toBe(false);
    expect(canAdvanceDeliveryStatus('delivered', 'sent')).toBe(false);
    expect(canAdvanceDeliveryStatus('read', 'read')).toBe(false);
  });

  it('lets any live status fail, and keeps failed and skipped final', () => {
    expect(canAdvanceDeliveryStatus('read', 'failed')).toBe(true);
    expect(canAdvanceDeliveryStatus('failed', 'read')).toBe(false);
    expect(canAdvanceDeliveryStatus('failed', 'failed')).toBe(false);
    expect(canAdvanceDeliveryStatus('skipped', 'sent')).toBe(false);
  });
});

describe('statusesThatMayAdvanceTo', () => {
  it('lists the statuses an update may replace', () => {
    expect(statusesThatMayAdvanceTo('delivered')).toEqual(['queued', 'sent']);
    expect(statusesThatMayAdvanceTo('failed')).toEqual(['queued', 'sent', 'delivered', 'read']);
    expect(statusesThatMayAdvanceTo('queued')).toEqual([]);
  });
});
