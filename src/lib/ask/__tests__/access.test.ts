import { describe, expect, it } from 'vitest';
import { canUseAsk, defaultShellForRole, shellAllowedForRole } from '@/lib/ask/access';

describe('Ask VCFO role access', () => {
  it.each(['client', 'manager', 'admin', 'super_admin'] as const)('%s may use Ask VCFO', (role) => {
    expect(canUseAsk(role)).toBe(true);
  });

  it('Project Leads and unknown roles may not', () => {
    expect(canUseAsk('intern')).toBe(false);
    expect(canUseAsk(null)).toBe(false);
    expect(canUseAsk('')).toBe(false);
  });

  it('a manager gets the staff shell only — never a client shell or the super shell', () => {
    expect(defaultShellForRole('manager')).toBe('admin');
    expect(shellAllowedForRole('manager', 'admin')).toBe(true);
    expect(shellAllowedForRole('manager', 'client')).toBe(false);
    expect(shellAllowedForRole('manager', 'super')).toBe(false);
  });
});
