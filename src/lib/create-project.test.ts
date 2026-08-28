import { describe, expect, it } from 'vitest';
import { resolveCreateProjectManagerAssignment } from '@/lib/create-project-scope';
import { createProjectBodySchema } from '@/lib/api/schemas';
import { errorMessage } from '@/lib/toast-errors';
import {
  reconcileSelectedIds,
  isPlaceholderTeamId,
} from '@/components/admin/create-project-form-utils';
import {
  adminProjectPath,
  staffNewProjectPath,
  staffProjectBase,
  staffProjectBaseFromPathname,
} from '@/lib/project-step-path';

const validBody = {
  companyName: 'Acme GCC',
  companyType: 'domestic' as const,
  parentEntityName: 'Acme Holdings',
  parentEntityAddress: '1 MG Road, Bengaluru',
  clientEmail: 'founder@acme.test',
  clientPassword: 'SBC@2026',
  internId: 'intern-1',
};

describe('resolveCreateProjectManagerAssignment', () => {
  it('forces manager POST to self and keeps extras as co-managers', () => {
    const result = resolveCreateProjectManagerAssignment({
      role: 'manager',
      userId: 'mgr-self',
      managerId: 'someone-else',
      managerIds: ['extra-1', 'mgr-self'],
    });
    expect(result.primaryManagerId).toBe('mgr-self');
    expect(result.uniqueManagerIds).toEqual(['mgr-self', 'extra-1', 'someone-else']);
  });

  it('requires managerId for admin and uses the first id as primary', () => {
    expect(() =>
      resolveCreateProjectManagerAssignment({
        role: 'admin',
        userId: 'admin-1',
      }),
    ).toThrow(/managerId is required/);

    const result = resolveCreateProjectManagerAssignment({
      role: 'super_admin',
      userId: 'super-1',
      managerIds: ['mgr-a', 'mgr-b'],
    });
    expect(result.primaryManagerId).toBe('mgr-a');
    expect(result.uniqueManagerIds).toEqual(['mgr-a', 'mgr-b']);
  });
});

describe('createProjectBodySchema', () => {
  it('rejects a body with no project lead', () => {
    const parsed = createProjectBodySchema.safeParse({
      ...validBody,
      internId: undefined,
      internIds: [],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.message === 'intern_required')).toBe(true);
    }
  });

  it('accepts internIds without internId', () => {
    const parsed = createProjectBodySchema.safeParse({
      ...validBody,
      internId: undefined,
      internIds: ['intern-1'],
    });
    expect(parsed.success).toBe(true);
  });
});

describe('reconcileSelectedIds', () => {
  it('drops mock tm* ids and defaults to the first real option', () => {
    expect(isPlaceholderTeamId('tm1')).toBe(true);
    expect(reconcileSelectedIds(['tm1'], ['intern-1', 'intern-2'])).toEqual(['intern-1']);
    expect(reconcileSelectedIds(['intern-2', 'tm1'], ['intern-1', 'intern-2'])).toEqual([
      'intern-2',
    ]);
    expect(reconcileSelectedIds(['tm1'], [])).toEqual([]);
  });
});

describe('staff project paths', () => {
  it('maps super shell to admin project routes', () => {
    expect(staffProjectBase('/app/super')).toBe('/app/admin');
    expect(staffProjectBase('super_admin')).toBe('/app/admin');
    expect(staffNewProjectPath('super_admin')).toBe('/app/admin/projects/new');
    expect(adminProjectPath({ id: 'e1', slug: 'acme' }, '/app/super')).toBe(
      '/app/admin/projects/acme',
    );
  });

  it('keeps manager paths in the manager shell', () => {
    expect(staffProjectBaseFromPathname('/app/manager/dashboard', 'super_admin')).toBe(
      '/app/manager',
    );
    expect(staffProjectBaseFromPathname('/app/admin/projects/new', 'manager')).toBe('/app/admin');
    expect(staffNewProjectPath('/app/manager')).toBe('/app/manager/projects/new');
  });
});

describe('create-project error copy', () => {
  it('maps API codes to readable messages', () => {
    expect(errorMessage(new Error('intern_required'))).toMatch(/project lead/i);
    expect(errorMessage(new Error('email_already_registered'))).toMatch(/already has an account/i);
    expect(errorMessage(new Error('managerId is required when creating as admin'))).toMatch(
      /project manager/i,
    );
    expect(errorMessage(new Error('Invalid internId — no intern profile found'))).toMatch(
      /valid project lead/i,
    );
  });
});
