import { describe, expect, it } from 'vitest';
import { DEMO_BLOCKED_MESSAGE, DemoBlockedError, assertNotDemo, isDemoBlockedError, isDemoEmail } from './demo-logins';

describe('demo logins (pure rules)', () => {
  it('recognises demo mailboxes, with or without a display name', () => {
    expect(isDemoEmail('lead@vcfosuite.com')).toBe(true);
    expect(isDemoEmail('Arjun Rao <LEAD@VCFOSUITE.COM>')).toBe(true);
    expect(isDemoEmail('someone@sbcllp.in')).toBe(false);
    expect(isDemoEmail('x@vcfosuite.com.evil.in')).toBe(false);
    expect(isDemoEmail('x@notvcfosuite.com')).toBe(false);
    expect(isDemoEmail(null)).toBe(false);
  });

  it('assertNotDemo throws the shared message for a demo context only', () => {
    expect(() => assertNotDemo({ demo: true }, 'x')).toThrow(DEMO_BLOCKED_MESSAGE);
    expect(() => assertNotDemo({ demo: false })).not.toThrow();
    expect(() => assertNotDemo({})).not.toThrow();
    expect(isDemoBlockedError(new DemoBlockedError())).toBe(true);
    expect(DEMO_BLOCKED_MESSAGE).toBe('Not available on demo logins');
  });
});
