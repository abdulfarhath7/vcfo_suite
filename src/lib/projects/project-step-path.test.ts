import { describe, expect, it } from 'vitest';
import {
  isInternEngagementPathname,
  isInternEngagementStepPathname,
  adminProjectPath,
  staffProjectBase,
  staffProjectBaseFromPathname,
  boardResolutionPathFor,
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

describe('boardResolutionPathFor', () => {
  const project = { id: 'x', slug: 'demo' };

  it('keeps a manager in the manager area, on every page that shows the link', () => {
    expect(boardResolutionPathFor('manager', project)).toBe('/app/manager/projects/demo/board-resolution');
    expect(boardResolutionPathFor('manager', project, '/app/manager/projects/demo')).toBe(
      '/app/manager/projects/demo/board-resolution',
    );
    expect(boardResolutionPathFor('manager', project, '/app/manager/projects/demo/step/pre-2')).toBe(
      '/app/manager/projects/demo/board-resolution',
    );
  });

  it('keeps an admin in the admin area', () => {
    expect(boardResolutionPathFor('admin', project)).toBe('/app/admin/projects/demo/board-resolution');
    expect(boardResolutionPathFor('admin', project, '/app/admin/projects/demo')).toBe(
      '/app/admin/projects/demo/board-resolution',
    );
  });

  it('keeps the super admin in the shell the project was opened from', () => {
    expect(boardResolutionPathFor('super_admin', project)).toBe('/app/admin/projects/demo/board-resolution');
    expect(boardResolutionPathFor('super_admin', project, '/app/super/projects/x')).toBe(
      '/app/admin/projects/demo/board-resolution',
    );
    expect(boardResolutionPathFor('super_admin', project, '/app/manager/projects/demo')).toBe(
      '/app/manager/projects/demo/board-resolution',
    );
    expect(boardResolutionPathFor('super_admin', project, '/app/lead/engagements/demo')).toBe(
      '/app/lead/engagements/demo/board-resolution',
    );
  });

  it('sends the lead and the client to their own pages', () => {
    expect(boardResolutionPathFor('intern', project, '/app/lead/engagements/demo')).toBe(
      '/app/lead/engagements/demo/board-resolution',
    );
    expect(boardResolutionPathFor('client', project)).toBe('/app/client/board-resolution');
  });

  it('never sends a manager or an admin into the lead area', () => {
    for (const role of ['manager', 'admin', undefined]) {
      for (const pathname of [undefined, '/app/lead/engagements/demo', '/app/manager/projects/demo']) {
        expect(boardResolutionPathFor(role, project, pathname)).not.toMatch(/^\/app\/lead\//);
      }
    }
  });
});

describe('staffProjectBaseFromPathname', () => {
  it('follows the shell in the address, then the role', () => {
    expect(staffProjectBaseFromPathname('/app/manager/projects/demo/step/pre-1', 'super_admin')).toBe('/app/manager');
    expect(staffProjectBaseFromPathname('/app/admin/projects/demo/step/pre-1', 'super_admin')).toBe('/app/admin');
    expect(staffProjectBaseFromPathname(null, 'manager')).toBe('/app/manager');
    expect(staffProjectBaseFromPathname(undefined, 'admin')).toBe('/app/admin');
  });
});
