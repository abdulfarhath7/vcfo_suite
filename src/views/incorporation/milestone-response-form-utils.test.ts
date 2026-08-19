import { describe, expect, it } from 'vitest';
import type { ChecklistField } from '@/data/checklist';
import {
  getMilestoneFormFieldLayout,
  groupFieldsBySection,
  internNamedSectionGroups,
} from '@/views/incorporation/milestone-response-form-utils';

function field(partial: Partial<ChecklistField> & Pick<ChecklistField, 'id' | 'type'>): ChecklistField {
  return { label: partial.id, ...partial };
}

describe('getMilestoneFormFieldLayout', () => {
  it('treats text, date, and select as short so consecutive fields can pair', () => {
    expect(getMilestoneFormFieldLayout(field({ id: 'firstName', type: 'text' }))).toBe('short');
    expect(getMilestoneFormFieldLayout(field({ id: 'boardDate', type: 'date' }))).toBe('short');
    expect(getMilestoneFormFieldLayout(field({ id: 'gender', type: 'select' }))).toBe('short');
  });

  it('keeps textareas, files, and address text full width', () => {
    expect(getMilestoneFormFieldLayout(field({ id: 'notes', type: 'textarea' }))).toBe('full');
    expect(getMilestoneFormFieldLayout(field({ id: 'scanUrl', type: 'file' }))).toBe('full');
    expect(
      getMilestoneFormFieldLayout(
        field({ id: 'parentEntityAddress', type: 'text', label: 'Complete Address' }),
      ),
    ).toBe('full');
  });

  it('uses long helper paragraphs as full width, not short one-liners', () => {
    expect(
      getMilestoneFormFieldLayout(
        field({
          id: 'companyMobileNumber',
          type: 'text',
          helperText: 'Digits only, without the country code prefix.',
        }),
      ),
    ).toBe('short');
    expect(
      getMilestoneFormFieldLayout(
        field({
          id: 'cin',
          type: 'text',
          helperText:
            'A unique 21-character identification number assigned to every company incorporated in India. The CIN contains details such as listing status, industry type, state of registration, and year of incorporation.',
        }),
      ),
    ).toBe('full');
  });

  it('honors an explicit layout override', () => {
    expect(
      getMilestoneFormFieldLayout(field({ id: 'proposedName1', type: 'text', layout: 'full' })),
    ).toBe('full');
    expect(
      getMilestoneFormFieldLayout(field({ id: 'notes', type: 'textarea', layout: 'short' })),
    ).toBe('short');
  });
});

describe('internNamedSectionGroups', () => {
  it('folds ungrouped remarks into intern named section tabs', () => {
    const groups = groupFieldsBySection([
      field({ id: 'name', type: 'text', section: 'Foreign Entity' }),
      field({ id: 'proof', type: 'file', section: 'Foreign Entity Proof' }),
      field({ id: 'stepRemarks', type: 'textarea' }),
    ]);
    expect(internNamedSectionGroups(groups).map((group) => group.section)).toEqual([
      'Foreign Entity',
      'Foreign Entity Proof',
    ]);
    expect(internNamedSectionGroups(groups)[1]?.fields.map((row) => row.id)).toEqual([
      'proof',
      'stepRemarks',
    ]);
  });
});
