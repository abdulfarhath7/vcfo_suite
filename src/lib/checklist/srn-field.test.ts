import { describe, expect, it } from 'vitest';
import { CLIENT_RESPONSE_FIELDS, SRN_LABEL, validateInternDelivery } from './checklist-responses';

/** SA-01: every filed application has the acknowledgement number, and a step cannot finish without it. */
describe('acknowledgement number (SRN)', () => {
  it.each(['pre-4', 'pre-10', 'post-2', 'post-6'])('%s asks for it with the one label', (itemId) => {
    const field = (CLIENT_RESPONSE_FIELDS[itemId] ?? []).find((f) => f.id === 'acknowledgementNumber');
    expect(field?.label.startsWith(SRN_LABEL)).toBe(true);
    expect(field?.required).toBe(true);
  });

  it('stops the name application from completing while it is empty', () => {
    const empty = validateInternDelivery('pre-4', { nameApplicationAcknowledgementUrl: 'eng/ack.pdf' });
    expect(empty.ok).toBe(false);
    expect(empty.errors.acknowledgementNumber).toMatch(/SRN/);
    const filled = validateInternDelivery('pre-4', { nameApplicationAcknowledgementUrl: 'eng/ack.pdf', acknowledgementNumber: 'AB1234567' });
    expect(filled.errors.acknowledgementNumber).toBeUndefined();
  });
});
