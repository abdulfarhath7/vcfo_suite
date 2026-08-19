import { describe, expect, it } from 'vitest';
import {
  canAccessEmailTemplates,
  canCreateEmailTemplate,
  canMutateEmailTemplate,
} from './email-template-access';

describe('email template access', () => {
  it('blocks clients', () => {
    expect(canAccessEmailTemplates('client')).toBe(false);
    expect(canCreateEmailTemplate('client')).toBe(false);
    expect(canMutateEmailTemplate({ role: 'client', userId: 'c1' }, 'c1')).toBe(false);
  });

  it('lets staff create and admins/managers edit any', () => {
    expect(canCreateEmailTemplate('intern')).toBe(true);
    expect(canMutateEmailTemplate({ role: 'admin', userId: 'a1' }, 'other')).toBe(true);
    expect(canMutateEmailTemplate({ role: 'manager', userId: 'm1' }, 'other')).toBe(true);
    expect(canMutateEmailTemplate({ role: 'intern', userId: 'i1' }, 'other')).toBe(false);
    expect(canMutateEmailTemplate({ role: 'intern', userId: 'i1' }, 'i1')).toBe(true);
  });
});
