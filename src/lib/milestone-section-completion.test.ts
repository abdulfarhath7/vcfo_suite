import { describe, expect, it } from 'vitest';
import { CLIENT_RESPONSE_FIELDS } from '@/lib/checklist-responses';
import {
  getPre1VisibleFields,
  validatePre1Responses,
} from '@/lib/checklist-pre1-validation';
import {
  getSectionPendingItems,
  isSectionFieldsComplete,
} from '@/lib/milestone-section-completion';

describe('getSectionPendingItems pre-1 Proposed Directors', () => {
  const pre1Fields = CLIENT_RESPONSE_FIELDS['pre-1'];

  function directorSectionFields(responses: Record<string, string>) {
    const visible = getPre1VisibleFields(pre1Fields, responses);
    return visible.filter((f) => f.section === 'Proposed Directors');
  }

  it('does not require optional DIN or DSC fields when two directors are filled', () => {
    const responses = {
      directorCount: '2',
      director1FirstName: 'Jane',
      director1LastName: 'Doe',
      director1Gender: 'female',
      director1IndiaResident: 'yes',
      director2FirstName: 'John',
      director2LastName: 'Smith',
      director2Gender: 'male',
      director2IndiaResident: 'no',
    };
    const fields = directorSectionFields(responses);
    const errors = validatePre1Responses(responses).errors;

    expect(getSectionPendingItems(fields, responses, errors)).toEqual([]);
    expect(isSectionFieldsComplete(fields, responses, errors)).toBe(true);
  });

  it('flags missing required director fields', () => {
    const responses = {
      directorCount: '2',
      director1FirstName: 'Jane',
      director1LastName: 'Doe',
      director1Gender: 'female',
      director1IndiaResident: 'yes',
    };
    const fields = directorSectionFields(responses);
    const pending = getSectionPendingItems(fields, responses);

    expect(pending.map((p) => p.label)).toEqual([
      'Director 2 — First name',
      'Director 2 — Last name',
      'Director 2 — Gender',
      'Director 2 — Resident of India',
    ]);
  });

  it('flags when no director is an India resident', () => {
    const responses = {
      directorCount: '2',
      director1FirstName: 'Jane',
      director1LastName: 'Doe',
      director1Gender: 'female',
      director1IndiaResident: 'no',
      director2FirstName: 'John',
      director2LastName: 'Smith',
      director2Gender: 'male',
      director2IndiaResident: 'no',
    };
    const fields = directorSectionFields(responses);
    const errors = validatePre1Responses(responses).errors;

    expect(getSectionPendingItems(fields, responses, errors).map((p) => p.label)).toContain(
      'At least one proposed director must be a resident of India.',
    );
    expect(isSectionFieldsComplete(fields, responses, errors)).toBe(false);
  });

  it('does not require hidden director 3/4 fields when count is 2', () => {
    const responses = { directorCount: '2' };
    const fields = directorSectionFields(responses);
    const ids = fields.map((f) => f.id);

    expect(ids.some((id) => id.startsWith('director3'))).toBe(false);
    expect(ids.some((id) => id.startsWith('director4'))).toBe(false);
  });
});
