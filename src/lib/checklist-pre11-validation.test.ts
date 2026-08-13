import { describe, expect, it } from 'vitest';
import { validatePre11Responses } from '@/lib/checklist-pre11-validation';

describe('validatePre11Responses', () => {
  it('requires remarks, client request, clarification letter, and resubmission notes', () => {
    const { ok, errors } = validatePre11Responses({});
    expect(ok).toBe(false);
    expect(errors.mcaRemarksSummary).toBeDefined();
    expect(errors.clientInformationRequested).toBeDefined();
    expect(errors.clarificationLetterUrl).toBeDefined();
    expect(errors.resubmissionNotes).toBeDefined();
  });

  it('accepts complete resubmission payload', () => {
    const { ok, errors } = validatePre11Responses({
      mcaRemarksSummary: 'Query on registered office proof.',
      clientInformationRequested: 'None',
      clarificationLetterUrl: 'eng/pre-11/clarification.pdf',
      resubmissionNotes: 'Resubmitted with updated utility bill.',
    });
    expect(ok).toBe(true);
    expect(errors).toEqual({});
  });
});
