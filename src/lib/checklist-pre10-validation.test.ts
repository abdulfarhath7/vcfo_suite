import { describe, expect, it } from 'vitest';
import { validatePre10Responses } from '@/lib/checklist-pre10-validation';

describe('validatePre10Responses', () => {
  it('requires filing notes', () => {
    const { ok, errors } = validatePre10Responses({});
    expect(ok).toBe(false);
    expect(errors.spicePartBAndAgileFiledNotes).toBeDefined();
  });

  it('accepts valid filing notes', () => {
    const { ok, errors } = validatePre10Responses({
      spicePartBAndAgileFiledNotes: 'SPICe+ Part B and AGILE-PRO-S filed on 2026-06-01.',
    });
    expect(ok).toBe(true);
    expect(errors).toEqual({});
  });
});
