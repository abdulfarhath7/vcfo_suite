import { describe, expect, it } from 'vitest';
import { prospectCreateSchema, prospectPatchSchema } from './prospect-schema';

describe('prospect schemas', () => {
  it('turns blank strings into null and keeps absent keys absent', () => {
    const parsed = prospectPatchSchema.parse({ company: '  ', nextStepOn: '', email: '' });
    expect(parsed).toEqual({ company: null, nextStepOn: null, email: null });
    expect(prospectPatchSchema.parse({ stage: 'won' })).toEqual({ stage: 'won' });
  });

  it('refuses an empty patch, an unknown stage and a bad date', () => {
    expect(prospectPatchSchema.safeParse({}).success).toBe(false);
    expect(prospectPatchSchema.safeParse({ stage: 'maybe' }).success).toBe(false);
    expect(prospectPatchSchema.safeParse({ nextStepOn: '14 Oct' }).success).toBe(false);
  });

  it('takes either the fields or a demo request id', () => {
    expect(prospectCreateSchema.safeParse({ name: 'Asha' }).success).toBe(true);
    expect(prospectCreateSchema.safeParse({ demoRequestId: '11111111-1111-4111-8111-111111111111' }).success).toBe(true);
    expect(prospectCreateSchema.safeParse({}).success).toBe(false);
  });
});
