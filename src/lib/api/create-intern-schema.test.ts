import { describe, expect, it } from 'vitest';
import { createInternBodySchema } from './schemas';

const base = { email: 'priya@sbcllp.in', password: 'Str0ngPass' };

function phoneIssue(phone: string) {
  const parsed = createInternBodySchema.safeParse({ ...base, phone });
  return parsed.success ? null : parsed.error.issues.find((i) => i.path[0] === 'phone')?.message;
}

describe('createInternBodySchema phone', () => {
  it('accepts common Indian formats', () => {
    expect(phoneIssue('+91 98765 43210')).toBeNull();
    expect(phoneIssue('9876543210')).toBeNull();
    expect(phoneIssue('+91-98765-43210')).toBeNull();
  });

  it('accepts a missing phone', () => {
    expect(createInternBodySchema.safeParse(base).success).toBe(true);
  });

  it('rejects letters and numbers that are too short or too long', () => {
    expect(phoneIssue('abc')).toBe('invalid_phone');
    expect(phoneIssue('12345')).toBe('invalid_phone');
    expect(phoneIssue('+1234567890123456')).toBe('invalid_phone');
  });
});
