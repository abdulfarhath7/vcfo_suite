import { describe, expect, it } from 'vitest';
import { getClientResponseFields } from '@/lib/checklist-responses';
import { getItem } from '@/data/checklist';
import { getStepAttachmentRequirements } from '@/lib/checklist-step-attachments';

describe('getStepAttachmentRequirements', () => {
  it('lists file fields and uploaded names from responses', () => {
    const item = getItem('pre-1');
    expect(item).toBeTruthy();
    if (!item) return;
    const fileFields = getClientResponseFields(item).filter((field) => field.type === 'file');
    expect(fileFields.length).toBeGreaterThan(0);
    const first = fileFields[0]!;
    const none = getStepAttachmentRequirements(item, {});
    expect(none.find((row) => row.fieldId === first.id)?.uploaded).toBe(false);
    const uploaded = getStepAttachmentRequirements(item, {
      [first.id]: 'eng/field/123-passport.pdf',
    });
    expect(uploaded.find((row) => row.fieldId === first.id)).toMatchObject({
      uploaded: true,
      fileName: 'passport.pdf',
    });
  });
});
