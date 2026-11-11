import { describe, expect, it } from 'vitest';
import { directorSlotComplete, withDirectorCount, withDirectorRemoved } from './director-count-control';

describe('withDirectorCount', () => {
  it('adds a director up to four', () => {
    expect(withDirectorCount({ directorCount: '2' }, 3).directorCount).toBe('3');
    expect(withDirectorCount({ directorCount: '4' }, 5).directorCount).toBe('4');
  });

  it('clears the answers of a removed director and never goes below one', () => {
    const next = withDirectorCount(
      { directorCount: '3', director3FirstName: 'Meera', director3LastName: 'Iyer', director2FirstName: 'Kiran' },
      2,
    );
    expect(next).toMatchObject({ directorCount: '2', director3FirstName: '', director3LastName: '', director2FirstName: 'Kiran' });
    expect(withDirectorCount({ directorCount: '2' }, 0).directorCount).toBe('1');
  });
});

describe('name approval expiry (SA-02)', () => {
  it('recalculates when the approval date changes, unless staff set the expiry by hand', async () => {
    const { cascadeDraftFieldChange } = await import('./field-cascade');
    const { computeMcaNameApprovalExpiryDate } = await import('@/lib/checklist/checklist-responses');
    const calculated = cascadeDraftFieldChange('pre-5', {}, 'nameApprovalDate', '2026-11-01');
    expect(calculated.nameApprovalExpiryDate).toBe(computeMcaNameApprovalExpiryDate('2026-11-01'));
    const edited = { ...calculated, nameApprovalExpiryDate: '2027-02-15' };
    expect(cascadeDraftFieldChange('pre-5', edited, 'nameApprovalDate', '2026-11-05').nameApprovalExpiryDate).toBe('2027-02-15');
  });
});

describe('director cards (CD-02)', () => {
  it('renumbers the cards after a removal', () => {
    const before = {
      directorCount: '3',
      director1FirstName: 'Asha',
      director2FirstName: 'Kiran',
      director2LastName: 'Rao',
      director3FirstName: 'Meera',
      director3LastName: 'Iyer',
    };
    const after = withDirectorRemoved(before, 2, 3);
    expect(after.directorCount).toBe('2');
    expect(after.director1FirstName).toBe('Asha');
    // Director 3 is now Director 2; the old third slot is empty.
    expect(after.director2FirstName).toBe('Meera');
    expect(after.director2LastName).toBe('Iyer');
    expect(after.director3FirstName).toBe('');
  });

  it('never removes the last card', () => {
    const one = { directorCount: '1', director1FirstName: 'Asha' };
    expect(withDirectorRemoved(one, 1, 1)).toBe(one);
  });

  it('marks a card complete only with name, gender and residence', () => {
    expect(directorSlotComplete({ director1FirstName: 'A', director1LastName: 'B', director1Gender: 'female' }, 1)).toBe(false);
    expect(directorSlotComplete({ director1FirstName: 'A', director1LastName: 'B', director1Gender: 'female', director1IndiaResident: 'yes' }, 1)).toBe(true);
  });
});

describe('minimum directors (CD-01)', () => {
  it('a private company with one director gets an error at submit; two submit without it', async () => {
    const { validatePre1Responses } = await import('@/lib/checklist/checklist-pre1-validation');
    const one = validatePre1Responses({ directorCount: '1', director1FirstName: 'A', director1LastName: 'B', director1Gender: 'female', director1IndiaResident: 'yes' });
    expect(one.errors.directorCount).toMatch(/at least 2 directors/);
    const two = validatePre1Responses({
      directorCount: '2',
      director1FirstName: 'A', director1LastName: 'B', director1Gender: 'female', director1IndiaResident: 'yes',
      director2FirstName: 'C', director2LastName: 'D', director2Gender: 'male', director2IndiaResident: 'no',
    });
    expect(two.errors.directorCount).toBeUndefined();
  });
});
