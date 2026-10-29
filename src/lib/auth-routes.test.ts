import { describe, expect, it } from 'vitest';
import { roleProfilePath } from './auth-routes';

describe('roleProfilePath', () => {
  it('sends every role to its own profile page', () => {
    expect(roleProfilePath('admin')).toBe('/app/admin/profile');
    expect(roleProfilePath('manager')).toBe('/app/manager/profile');
    expect(roleProfilePath('intern')).toBe('/app/intern/profile');
    expect(roleProfilePath('super_admin')).toBe('/app/super/profile');
    expect(roleProfilePath('client')).toBe('/app/client/profile');
    expect(roleProfilePath('developer')).toBe('/app/dev/profile');
  });
});
