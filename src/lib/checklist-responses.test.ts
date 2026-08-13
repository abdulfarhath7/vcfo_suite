import { describe, expect, it } from 'vitest';
import { checklist } from '@/data/checklist';
import {
  appendStepRemarksToVisible,
  computeMcaNameApprovalExpiryDate,
  getClientResponseFields,
  isStepRemarksField,
  MCA_NAME_APPROVAL_VALIDITY_DAYS,
  STEP_REMARKS_FIELD,
  STEP_REMARKS_FIELD_ID,
} from '@/lib/checklist-responses';
import { getPre6VisibleFields } from '@/lib/checklist-pre6-validation';
import { isSectionFieldsComplete } from '@/lib/milestone-section-completion';

describe('computeMcaNameApprovalExpiryDate', () => {
  it('adds 20 calendar days to the approval date', () => {
    expect(computeMcaNameApprovalExpiryDate('2026-01-01')).toBe('2026-01-21');
    expect(MCA_NAME_APPROVAL_VALIDITY_DAYS).toBe(20);
  });

  it('returns empty string for invalid dates', () => {
    expect(computeMcaNameApprovalExpiryDate('')).toBe('');
    expect(computeMcaNameApprovalExpiryDate('not-a-date')).toBe('');
  });
});

describe('stepRemarks field', () => {
  it('appends stepRemarks to every checklist step field list', () => {
    for (const item of checklist) {
      const fields = getClientResponseFields(item);
      expect(fields.some((f) => f.id === STEP_REMARKS_FIELD_ID)).toBe(true);
    }
  });

  it('does not duplicate stepRemarks when already present', () => {
    const pre1 = checklist.find((c) => c.id === 'pre-1')!;
    const fields = getClientResponseFields(pre1);
    const remarksCount = fields.filter((f) => isStepRemarksField(f)).length;
    expect(remarksCount).toBe(1);
  });

  it('provides remarks-only form for steps with no other mapped fields', () => {
    const reg9 = checklist.find((c) => c.id === 'reg-9')!;
    expect(getClientResponseFields(reg9)).toEqual([STEP_REMARKS_FIELD]);
  });

  it('is optional for section completion', () => {
    expect(
      isSectionFieldsComplete([STEP_REMARKS_FIELD], { stepRemarks: '' }),
    ).toBe(true);
  });

  it('survives pre-6 conditional field filtering', () => {
    const pre6 = checklist.find((c) => c.id === 'pre-6')!;
    const allFields = getClientResponseFields(pre6);
    const visible = appendStepRemarksToVisible(
      getPre6VisibleFields(allFields, {}, {}),
      allFields,
    );
    expect(visible.some((f) => f.id === STEP_REMARKS_FIELD_ID)).toBe(true);
  });
});
