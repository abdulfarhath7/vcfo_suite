import { describe, expect, it } from 'vitest';

import { checklist } from '@/data/checklist';
import { validatePre8Responses } from '@/lib/checklist-pre8-validation';
import { formatResponseSummary, getClientResponseFields } from '@/lib/checklist-responses';
import { fieldsForDirectorAudiences, withoutUnusedDirectorSlots } from '@/lib/incorp-director-slots';

const pre8 = checklist.find((c) => c.id === 'pre-8')!;
const fields = getClientResponseFields(pre8);

const LEGACY_PRE8_DIRECTOR_IDS = [
  'nrDirectorPassportSignedUrl',
  'residentDirectorPassportSignedUrl',
  'nrDirectorDrivingLicenceSignedUrl',
  'residentDirectorDrivingLicenceSignedUrl',
  'nrDirectorUtilityBillSignedUrl',
  'residentDirectorUtilityBillSignedUrl',
  'nrDirectorDir2SignedUrl',
  'residentDirectorDir2SignedUrl',
  'nrDirectorDir8SignedUrl',
  'residentDirectorDir8SignedUrl',
  'nrDirectorInc9SignedUrl',
  'residentDirectorInc9SignedUrl',
  'nrDirectorPanUndertakingSignedUrl',
];

describe('pre-8 signed uploads follow the director list', () => {
  it('slot-1 ids are unchanged and still declared', () => {
    const ids = new Set(fields.map((f) => f.id));
    for (const id of LEGACY_PRE8_DIRECTOR_IDS) expect(ids.has(id)).toBe(true);
  });

  it('no director context: exactly the legacy required set', () => {
    const errors = Object.keys(validatePre8Responses({}).errors);
    expect(errors.filter((id) => /^(nrDirector|residentDirector)\d/.test(id))).toEqual([]);
    expect(errors).toContain('nrDirectorDir2SignedUrl');
  });

  it('two residents: resident-2 uploads required, no non-resident uploads', () => {
    const errors = validatePre8Responses({}, { directors: ['resident', 'resident-2'] }).errors;
    expect(errors.nrDirectorDir2SignedUrl).toBeUndefined();
    expect(errors.residentDirector2Dir2SignedUrl).toBeDefined();
    expect(errors.residentDirector2UtilityBillSignedUrl).toBeDefined();
    expect(errors.authorisationLetterSignedUrl).toBeDefined();
  });

  it('accepted pre-8: a director added later is optional, not a silent re-lock', () => {
    const slots = { directors: ['non-resident', 'resident', 'resident-2'] as const, frozen: true };
    expect(validatePre8Responses({}, slots).errors.residentDirector2Dir2SignedUrl).toBeUndefined();
    const field = fieldsForDirectorAudiences(fields, slots).find((f) => f.id === 'residentDirector2Dir2SignedUrl');
    expect(field?.required).toBe(false);
  });

  it('read-only lists hide unused later slots but keep ones with uploads', () => {
    const plain = withoutUnusedDirectorSlots('pre-8', fields, {});
    expect(plain.some((f) => f.id === 'residentDirector2Dir2SignedUrl')).toBe(false);
    const withUpload = withoutUnusedDirectorSlots('pre-8', fields, { residentDirector2Dir2SignedUrl: 'a/b/1-x.pdf' });
    expect(withUpload.some((f) => f.id === 'residentDirector2Inc9SignedUrl')).toBe(true);
  });

  it('the pre-8 summary does not count hidden later slots', () => {
    const summary = formatResponseSummary(pre8, {});
    const legacyCount = fields.filter(
      (f) => !/^(nrDirector|residentDirector)\d/.test(f.id) && f.required !== false,
    ).length;
    expect(summary.fieldCount).toBe(legacyCount);
  });
});
