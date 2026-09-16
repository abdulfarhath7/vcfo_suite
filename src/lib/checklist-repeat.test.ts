import { describe, expect, it } from 'vitest';
import type { ChecklistField } from '@/data/checklist';
import {
  addRepeatEntry,
  applyShowWhen,
  expandRepeatEntry,
  expandRepeatFieldsForDiff,
  missingRequiredEntryFields,
  parseRepeatFieldId,
  removeRepeatEntry,
  repeatEntries,
  repeatFieldLabel,
  validateRepeatEntries,
  type RepeatField,
} from '@/lib/checklist-repeat';
import { getChangedPartial } from '@/views/incorporation/milestone-response-form-utils';

const group: RepeatField = {
  id: 'people',
  label: 'People',
  type: 'repeat',
  section: 'Team',
  entryLabel: 'Person',
  minEntries: 1,
  maxEntries: 3,
  entryFields: [
    { id: 'name', label: 'Name', type: 'text', required: true },
    { id: 'hasPet', label: 'Has a pet?', type: 'segmented', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
    { id: 'petName', label: 'Pet name', type: 'text', required: true, showWhen: { field: 'hasPet', value: 'yes' } },
    { id: 'photo', label: 'Photo', type: 'file' },
  ],
};
const fields: ChecklistField[] = [{ id: 'intro', label: 'Intro', type: 'text' }, group];

describe('repeat groups', () => {
  it('stores entries as an ordered id list plus dotted keys', () => {
    const { entryId, patch } = addRepeatEntry({}, group, 'e1');
    expect(entryId).toBe('e1');
    expect(patch).toEqual({ people: 'e1' });
    const second = addRepeatEntry(patch, group, 'e2').patch;
    expect(second).toEqual({ people: 'e1,e2' });
    const responses = { ...second, 'people.e1.name': 'Ada', 'people.e2.name': 'Bob', 'people.e2.hasPet': 'yes' };
    expect(repeatEntries(responses, group).map((e) => [e.index, e.values.name])).toEqual([[1, 'Ada'], [2, 'Bob']]);
    expect(parseRepeatFieldId('people.e2.name')).toEqual({ groupId: 'people', entryId: 'e2', fieldId: 'name' });
    expect(parseRepeatFieldId('name')).toBeNull();
  });

  it('re-points showWhen at the sibling inside the entry and honours it', () => {
    const concrete = expandRepeatEntry(group, 'e2');
    expect(concrete.find((f) => f.id === 'people.e2.petName')?.showWhen).toEqual({ field: 'people.e2.hasPet', value: 'yes' });
    const shown = applyShowWhen(concrete, { 'people.e2.hasPet': 'yes' }).map((f) => f.id);
    expect(shown).toContain('people.e2.petName');
    const hidden = applyShowWhen(concrete, { 'people.e2.hasPet': 'no' }).map((f) => f.id);
    expect(hidden).not.toContain('people.e2.petName');
    expect(concrete.every((f) => f.section === 'Team')).toBe(true);
  });

  it('removing an entry clears every key it owned and the diff carries the clears', () => {
    const saved = { people: 'e1,e2', 'people.e1.name': 'Ada', 'people.e2.name': 'Bob', 'people.e2.photo': 'x/y/1-p.png' };
    const draft = { ...saved, ...removeRepeatEntry(saved, group, 'e2') };
    expect(draft.people).toBe('e1');
    expect(draft['people.e2.name']).toBe('');
    const partial = getChangedPartial(fields, draft, saved);
    expect(partial).toEqual({ people: 'e1', 'people.e2.name': '', 'people.e2.photo': '' });
    // An added entry diffs too, even though `saved` never heard of it.
    const added = { ...saved, ...addRepeatEntry(saved, group, 'e3').patch, 'people.e3.name': 'Cy' };
    expect(getChangedPartial(fields, added, saved)).toEqual({ people: 'e1,e2,e3', 'people.e3.name': 'Cy' });
    expect(expandRepeatFieldsForDiff(fields, added, saved).some((f) => f.id === 'people.e3.name')).toBe(true);
  });

  it('validates min/max and per-entry rules with concrete error ids', () => {
    expect(validateRepeatEntries({}, group, () => ({}))).toEqual({ people: 'Add at least 1 person.' });
    const responses = { people: 'e1,e2', 'people.e1.name': 'Ada', 'people.e2.hasPet': 'yes' };
    const errors = validateRepeatEntries(responses, group, (entry) => missingRequiredEntryFields(group, entry));
    expect(errors).toEqual({ 'people.e2.name': 'This field is required.', 'people.e2.petName': 'This field is required.' });
    const four = { people: 'a,b,c,d' };
    expect(validateRepeatEntries(four, group, () => ({})).people).toMatch(/At most 3/);
  });

  it('labels a concrete field by template label and entry position', () => {
    const responses = { people: 'e1,e2' };
    expect(repeatFieldLabel(fields, responses, 'people.e2.photo')).toBe('Photo · Person 2');
    expect(repeatFieldLabel(fields, responses, 'intro')).toBeNull();
  });
});
