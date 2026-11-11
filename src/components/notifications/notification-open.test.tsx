import { describe, expect, it } from 'vitest';
import { stepPathForRole, NOTIFIED_HASH } from '@/lib/projects/project-step-path';

/** GL-01: "Open" goes to the exact step for each role, with the highlight marker. */
describe('stepPathForRole', () => {
  const project = { id: 'eng-1', slug: 'ember' };

  it('opens the exact step for the Lead, Manager, Admin and Client', () => {
    expect(stepPathForRole('intern', project, 'pre-1')).toMatch(/^\/app\/lead\/engagements\/ember\/step\/[^#]+#notified$/);
    expect(stepPathForRole('manager', project, 'pre-1')).toMatch(/^\/app\/manager\/projects\/ember\/step\/[^#]+#notified$/);
    expect(stepPathForRole('admin', project, 'pre-1')).toMatch(/^\/app\/admin\/projects\/ember\/step\/[^#]+#notified$/);
    expect(stepPathForRole('super_admin', project, 'pre-1')).toMatch(/^\/app\/admin\/projects\/ember\/step\//);
    expect(stepPathForRole('client', project, 'pre-1')).toMatch(/^\/app\/client\/incorporation\/step\/[^#]+#notified$/);
  });

  it('opens the board resolution page for its step', () => {
    expect(stepPathForRole('intern', project, 'pre-2', { boardResolution: true })).toBe(`/app/lead/engagements/ember/board-resolution${NOTIFIED_HASH}`);
    expect(stepPathForRole('client', project, 'pre-2', { boardResolution: true })).toBe(`/app/client/board-resolution${NOTIFIED_HASH}`);
  });
});
