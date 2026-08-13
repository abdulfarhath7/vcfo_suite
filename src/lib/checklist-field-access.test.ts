import { describe, expect, it } from 'vitest';
import { isInternDeliveryStep, isMilestoneFormReadOnly } from './checklist-field-access';

describe('isMilestoneFormReadOnly', () => {
  it('locks client view after intern delivery', () => {
    expect(
      isMilestoneFormReadOnly({
        variant: 'client',
        itemId: 'pre-5',
        itemState: { status: 'completed', deliveredToClientAt: '2026-06-01T00:00:00.000Z' },
      }),
    ).toBe(true);
  });

  it('keeps intern/manager form editable after delivery', () => {
    expect(
      isMilestoneFormReadOnly({
        variant: 'admin',
        itemId: 'pre-5',
        itemState: {
          status: 'completed',
          deliveredToClientAt: '2026-06-01T00:00:00.000Z',
        },
      }),
    ).toBe(false);
  });

  it('respects explicit readOnly for staff', () => {
    expect(
      isMilestoneFormReadOnly({
        readOnly: true,
        variant: 'admin',
        itemId: 'pre-5',
        itemState: { status: 'completed', deliveredToClientAt: '2026-06-01T00:00:00.000Z' },
      }),
    ).toBe(true);
  });

  it('does not lock staff on non-delivery steps', () => {
    expect(
      isMilestoneFormReadOnly({
        variant: 'admin',
        itemId: 'pre-1',
        itemState: { reviewStatus: 'accepted', status: 'completed' },
      }),
    ).toBe(false);
  });
});

describe('isInternDeliveryStep', () => {
  it('includes pre-5', () => {
    expect(isInternDeliveryStep('pre-5')).toBe(true);
    expect(isInternDeliveryStep('pre-1')).toBe(false);
  });
});
