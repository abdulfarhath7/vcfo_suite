import { describe, expect, it } from 'vitest';
import { validatePre9Responses } from '@/lib/checklist-pre9-validation';

describe('validatePre9Responses', () => {
  it('requires review notes and confirmation', () => {
    const { ok, errors } = validatePre9Responses({});
    expect(ok).toBe(false);
    expect(errors.spicePartBApplicationReview).toBeDefined();
    expect(errors.spicePartBConfirmation).toBeDefined();
  });

  it('accepts confirmed without recommended changes', () => {
    const { ok, errors } = validatePre9Responses({
      spicePartBApplicationReview: 'Reviewed and aligned with board resolution.',
      spicePartBConfirmation: 'confirmed',
    });
    expect(ok).toBe(true);
    expect(errors).toEqual({});
  });

  it('requires recommended changes when changes-recommended', () => {
    const { ok, errors } = validatePre9Responses({
      spicePartBApplicationReview: 'Found mismatched share capital.',
      spicePartBConfirmation: 'changes-recommended',
    });
    expect(ok).toBe(false);
    expect(errors.spicePartBRecommendedChanges).toBeDefined();
  });
});
