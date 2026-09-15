import { describe, expect, it } from 'vitest';
import { validatePre1Responses } from '@/lib/checklist-pre1-validation';
import { NIC_CODE_COUNT, isNicCodeFormat, nicBusinessType } from '@/lib/nic-2008';

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
