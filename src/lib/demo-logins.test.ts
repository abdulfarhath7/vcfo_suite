import { describe, expect, it } from 'vitest';
import { DEMO_BLOCKED_MESSAGE, DemoBlockedError, assertNotDemo, demoRoleAllowed, isDemoBlockedError, isDemoEmail } from './demo-logins';

describe('demo logins (pure rules)', () => {
  it('admits a demo profile only as a lead or a client', () => {
    expect(demoRoleAllowed(true, 'intern')).toBe(true);
    expect(demoRoleAllowed(true, 'client')).toBe(true);
    for (const role of ['admin', 'super_admin', 'manager', 'developer', 'partner', '', null]) {
      expect(demoRoleAllowed(true, role)).toBe(false);
    }
  });

  it('never affects a real profile', () => {
    for (const role of ['admin', 'super_admin', 'manager', 'intern', 'client', 'developer']) {
      expect(demoRoleAllowed(false, role)).toBe(true);
      expect(demoRoleAllowed(null, role)).toBe(true);
    }
  });

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
