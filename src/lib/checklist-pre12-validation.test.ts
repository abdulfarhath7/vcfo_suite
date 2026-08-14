import { describe, expect, it } from 'vitest';
import { validatePre12Responses } from '@/lib/checklist-pre12-validation';

describe('validatePre12Responses', () => {
  it('requires MCA identifiers and certificate documents', () => {
    const { ok, errors } = validatePre12Responses({});
    expect(ok).toBe(false);
    expect(errors.incorporatedCompanyName).toBeDefined();
    expect(errors.certificateOfIncorporationFinalUrl).toBeDefined();
    expect(errors.coiSignatureVerifiedByMca).toBeDefined();
  });

  it('accepts valid incorporation delivery payload', () => {
    const { ok, errors } = validatePre12Responses({
      incorporatedCompanyName: 'Acme India Private Limited',
      dateOfIncorporation: '2026-06-10',
      cin: 'U12345MH2026PTC123456',
      pan: 'AABCA1234A',
      tan: 'MUMB12345A',
      pfCode: 'MHMUM1234567000',
      esiCode: '1234567890',
      coiSignatureVerifiedByMca: 'yes',
      certificateOfIncorporationFinalUrl: 'eng/pre-12/coi.pdf',
      panCardFinalUrl: 'eng/pre-12/pan.pdf',
      tanCardFinalUrl: 'eng/pre-12/tan.pdf',
    });
    expect(ok).toBe(true);
    expect(errors).toEqual({});
  });
});
