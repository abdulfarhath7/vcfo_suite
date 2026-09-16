import { describe, expect, it } from 'vitest';
import { CLIENT_RESPONSE_FIELDS } from '@/lib/checklist-responses';
import {
  getSectionPendingItems,
  isSectionFieldsComplete,
} from '@/lib/milestone-section-completion';

const pre9 = CLIENT_RESPONSE_FIELDS['pre-9'] ?? [];

describe('getSectionPendingItems', () => {
  it('lists required fields that are still empty, in field order', () => {
    const pending = getSectionPendingItems(pre9, {});
    expect(pending.map((p) => p.fieldId)).toEqual(
      pre9.filter((f) => f.required !== false).map((f) => f.id),
    );
    expect(isSectionFieldsComplete(pre9, {})).toBe(false);
  });

  it('surfaces a validation error even on a filled field, once', () => {
    const filled = Object.fromEntries(pre9.map((f) => [f.id, 'x']));
    const [first] = pre9;
    const pending = getSectionPendingItems(pre9, filled, { [first!.id]: 'Bad value' });
    expect(pending).toEqual([{ fieldId: first!.id, label: first!.label }]);
    expect(isSectionFieldsComplete(pre9, filled)).toBe(true);
    expect(isSectionFieldsComplete(pre9, filled, { [first!.id]: 'Bad value' })).toBe(false);
  });
});
