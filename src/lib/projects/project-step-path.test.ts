import { describe, expect, it } from 'vitest';
import {
  isInternEngagementPathname,
  isInternEngagementStepPathname,
  adminProjectPath,
  staffProjectBase,
} from '@/lib/projects/project-step-path';

describe('isInternEngagementStepPathname', () => {
  it('matches intern checklist step URLs only', () => {
    expect(
      isInternEngagementStepPathname('/app/lead/engagements/pexpo-inc/step/client-details'),
    ).toBe(true);
    expect(isInternEngagementStepPathname('/app/lead/engagements/pexpo-inc/step')).toBe(true);
    expect(isInternEngagementStepPathname('/app/lead/engagements/pexpo-inc')).toBe(false);
    expect(
      isInternEngagementStepPathname('/app/lead/engagements/pexpo-inc/board-resolution'),
    ).toBe(false);
    expect(isInternEngagementPathname('/app/lead/engagements/pexpo-inc/step/client-details')).toBe(
      true,
    );
  });
});

describe('adminProjectPath', () => {
  it('does not emit /app/super/projects', () => {
    expect(staffProjectBase('super_admin')).toBe('/app/admin');
    expect(adminProjectPath({ id: 'x', slug: 'demo' }, 'super_admin')).toBe('/app/admin/projects/demo');
  });
});

describe('isInternEngagementStepPathname', () => {
  it('matches intern checklist step URLs only', () => {
    expect(
      isInternEngagementStepPathname('/app/lead/engagements/pexpo-inc/step/client-details'),
    ).toBe(true);
    expect(isInternEngagementStepPathname('/app/lead/engagements/pexpo-inc/step')).toBe(true);
    expect(isInternEngagementStepPathname('/app/lead/engagements/pexpo-inc')).toBe(false);
    expect(
      isInternEngagementStepPathname('/app/lead/engagements/pexpo-inc/board-resolution'),
    ).toBe(false);
    expect(isInternEngagementPathname('/app/lead/engagements/pexpo-inc/step/client-details')).toBe(
      true,
    );
  });
});
