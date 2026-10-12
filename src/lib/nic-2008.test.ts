import { describe, expect, it } from 'vitest';
import { DUPLICATE_NIC_CODE_MESSAGE, validatePre1Responses } from '@/lib/checklist-pre1-validation';
import { NIC_CODE_COUNT, isNicCodeFormat, nicBusinessType, readNicCodes } from '@/lib/nic-2008';

describe('nic-2008', () => {
  it('carries every NIC-2008 sub-class', () => {
    expect(NIC_CODE_COUNT).toBe(1302);
    expect(nicBusinessType('01111')?.description).toBe('Growing of wheat');
    expect(nicBusinessType('62011')?.description).toMatch(/computer program/i);
    // Corrected against the official sequence — omitted from the printed PDF.
    expect(nicBusinessType('60200')).not.toBeNull();
  });

  it('is a strict 5-digit lookup', () => {
    expect(isNicCodeFormat('62011')).toBe(true);
    expect(isNicCodeFormat('6201')).toBe(false);
    expect(isNicCodeFormat('620111')).toBe(false);
    expect(isNicCodeFormat('6201a')).toBe(false);
    expect(nicBusinessType('6201')).toBeNull();
    expect(nicBusinessType('00000')).toBeNull();
  });
});

describe('validatePre1Responses — NIC code', () => {
  it('rejects 4- and 6-digit input inline and warns on an unknown code', () => {
    expect(validatePre1Responses({ nicCode: '6201' }).errors.nicCode).toMatch(/5-digit/);
    expect(validatePre1Responses({ nicCode: '620111' }).errors.nicCode).toMatch(/5-digit/);
    const unknown = validatePre1Responses({ nicCode: '00000' });
    expect(unknown.errors.nicCode).toBeUndefined();
    expect(unknown.warnings.nicCode).toMatch(/No NIC-2008/);
    const ok = validatePre1Responses({ nicCode: '62011' });
    expect(ok.errors.nicCode).toBeUndefined();
    expect(ok.warnings.nicCode).toBeUndefined();
  });

  it('is required', () => {
    expect(validatePre1Responses({}).errors.nicCode).toBe('This field is required.');
  });
});

describe('readNicCodes', () => {
  it('lists the main code first, then the additional entries in order', () => {
    expect(
      readNicCodes({
        nicCode: '62011',
        nicBusinessType: 'Stored description',
        additionalNicCodes: 'b2,a1',
        'additionalNicCodes.a1.code': '62099',
        'additionalNicCodes.b2.code': '62020',
        'additionalNicCodes.b2.businessType': 'Consultancy',
      }),
    ).toEqual([
      { code: '62011', description: 'Stored description' },
      { code: '62020', description: 'Consultancy' },
      { code: '62099', description: nicBusinessType('62099')!.description },
    ]);
  });

  it('skips blank codes and returns nothing for an empty record', () => {
    expect(readNicCodes({})).toEqual([]);
    expect(readNicCodes({ additionalNicCodes: 'a1', 'additionalNicCodes.a1.code': ' ' })).toEqual([]);
  });
});

describe('validatePre1Responses — additional NIC codes', () => {
  const base = { nicCode: '62011' };

  it('requires 5 digits on each entry', () => {
    const result = validatePre1Responses({ ...base, additionalNicCodes: 'a1', 'additionalNicCodes.a1.code': '620' });
    expect(result.errors['additionalNicCodes.a1.code']).toMatch(/5-digit/);
  });

  it('requires a code on each entry', () => {
    const result = validatePre1Responses({ ...base, additionalNicCodes: 'a1' });
    expect(result.errors['additionalNicCodes.a1.code']).toBe('This field is required.');
  });

  it('warns on a code outside NIC-2008', () => {
    const result = validatePre1Responses({ ...base, additionalNicCodes: 'a1', 'additionalNicCodes.a1.code': '00000' });
    expect(result.errors['additionalNicCodes.a1.code']).toBeUndefined();
    expect(result.warnings['additionalNicCodes.a1.code']).toMatch(/No NIC-2008/);
  });

  it('refuses a code equal to the main code or to an earlier entry', () => {
    const result = validatePre1Responses({
      ...base,
      additionalNicCodes: 'a1,b2',
      'additionalNicCodes.a1.code': '62011',
      'additionalNicCodes.b2.code': '62011',
    });
    expect(result.errors['additionalNicCodes.a1.code']).toBe(DUPLICATE_NIC_CODE_MESSAGE);
    expect(result.errors['additionalNicCodes.b2.code']).toBe(DUPLICATE_NIC_CODE_MESSAGE);
    const twoEntries = validatePre1Responses({
      ...base,
      additionalNicCodes: 'a1,b2',
      'additionalNicCodes.a1.code': '62020',
      'additionalNicCodes.b2.code': '62020',
    });
    expect(twoEntries.errors['additionalNicCodes.a1.code']).toBeUndefined();
    expect(twoEntries.errors['additionalNicCodes.b2.code']).toBe(DUPLICATE_NIC_CODE_MESSAGE);
  });

  it('caps the list at nine', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `e${i}`);
    const responses: Record<string, string> = { ...base, additionalNicCodes: ids.join(',') };
    ids.forEach((id, i) => {
      responses[`additionalNicCodes.${id}.code`] = String(62020 + i).padStart(5, '0');
    });
    expect(validatePre1Responses(responses).errors.additionalNicCodes).toMatch(/At most 9/);
  });
});
