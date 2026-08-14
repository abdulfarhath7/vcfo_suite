import { describe, expect, it } from 'vitest';
import { applyPre6PrefillFromPre1 } from '@/lib/pre6-prefill-from-pre1';
import {
  getSectionPendingItems,
  isSectionFieldsComplete,
} from '@/lib/milestone-section-completion';
import { CLIENT_RESPONSE_FIELDS } from '@/lib/checklist-responses';
import { getPre6VisibleFields, validatePre6Responses } from '@/lib/checklist-pre6-validation';

const pre6Fields = CLIENT_RESPONSE_FIELDS['pre-6'];

describe('applyPre6PrefillFromPre1', () => {
  const pre1 = {
    directorCount: '2',
    director1FirstName: 'Jane',
    director1MiddleName: 'Q',
    director1LastName: 'Doe',
    director1Gender: 'female',
    director1IndiaResident: 'no',
    director2FirstName: 'Priya',
    director2LastName: 'Sharma',
    director2Gender: 'female',
    director2IndiaResident: 'yes',
  };

  it('maps NR and resident directors to matching pre-6 slot prefixes', () => {
    const merged = applyPre6PrefillFromPre1({}, pre1);
    expect(merged).toMatchObject({
      nrDirectorFirstName: 'Jane',
      nrDirectorMiddleName: 'Q',
      nrDirectorLastName: 'Doe',
      nrDirectorGender: 'female',
      residentDirectorFirstName: 'Priya',
      residentDirectorLastName: 'Sharma',
      residentDirectorGender: 'female',
    });
    expect(merged.residentDirectorMiddleName).toBeUndefined();
  });

  it('maps second NR director to nrDirector2 prefix', () => {
    const merged = applyPre6PrefillFromPre1(
      {},
      {
        directorCount: '2',
        director1IndiaResident: 'no',
        director1FirstName: 'A',
        director1LastName: 'One',
        director1Gender: 'male',
        director2IndiaResident: 'no',
        director2FirstName: 'B',
        director2LastName: 'Two',
        director2Gender: 'female',
      },
    );
    expect(merged.nrDirector2FirstName).toBe('B');
    expect(merged.nrDirector2Gender).toBe('female');
  });

  it('does not overwrite existing pre-6 values', () => {
    const merged = applyPre6PrefillFromPre1(
      { nrDirectorFirstName: 'Custom', nrDirectorGender: 'male' },
      pre1,
    );
    expect(merged.nrDirectorFirstName).toBe('Custom');
    expect(merged.nrDirectorGender).toBe('male');
    expect(merged.nrDirectorLastName).toBe('Doe');
  });

  it('uses legacy director name when split parts are missing', () => {
    const merged = applyPre6PrefillFromPre1(
      {},
      {
        directorCount: '1',
        director1Name: 'Legacy Director',
        director1Gender: 'other',
        director1IndiaResident: 'yes',
      },
    );
    expect(merged.residentDirectorFirstName).toBe('Legacy Director');
    expect(merged.residentDirectorGender).toBe('other');
  });

  it('reduces still-needed items for name and gender when prefilled', () => {
    const pre6 = applyPre6PrefillFromPre1({}, pre1);
    const visible = getPre6VisibleFields(pre6Fields, pre6, pre1);
    const nrSection = visible.filter((f) => f.section === 'Director 1 — Non-Resident');
    const errors = validatePre6Responses(pre6, pre1).errors;
    const pending = getSectionPendingItems(nrSection, pre6, errors);
    expect(pending.some((p) => p.fieldId === 'nrDirectorFirstName')).toBe(false);
    expect(pending.some((p) => p.fieldId === 'nrDirectorLastName')).toBe(false);
    expect(pending.some((p) => p.fieldId === 'nrDirectorGender')).toBe(false);
    expect(isSectionFieldsComplete(nrSection, pre6, errors)).toBe(false);
  });
});
