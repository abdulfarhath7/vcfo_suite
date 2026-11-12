import { describe, expect, it } from 'vitest';
import { diffChecklistForNotifications, type NotificationDraft } from '@/lib/checklist/checklist-notifications';
import { isDirectFlowStep } from '@/lib/incorporation/pre-inc-direct-flow';
import { notificationOpenHref } from '@/lib/notifications/notification-dismiss';
import { NOTIFIED_HASH, projectPathForRole, stepPathForRole } from '@/lib/projects/project-step-path';
import { checklist } from '@/data/checklist';

/*
 * GL-01: every notification type opens the exact step it names, for every role that gets it.
 * Old notifications without a link open the project overview.
 */

const engagement = { id: 'eng-1', slug: 'acme', companyName: 'Acme Pvt Ltd' };
const AT = '2026-11-11T05:00:00.000Z';
const STEP = 'post-1';
const DIRECT = checklist.find((c) => isDirectFlowStep(c.id))?.id ?? 'pre-1';

function only(drafts: NotificationDraft[], kind: NotificationDraft['kind']): NotificationDraft {
  const found = drafts.filter((d) => d.kind === kind);
  expect(found).toHaveLength(1);
  return found[0]!;
}

describe('GL-01 notification links', () => {
  it('checklist.deliver opens the step for the client', () => {
    const d = only(
      diffChecklistForNotifications({ [STEP]: { status: 'in-progress' } }, { [STEP]: { status: 'in-progress', deliveredToClientAt: AT } }, { engagement, viewerRole: 'client', viewerUserId: 'c1' }),
      'checklist.deliver',
    );
    expect(d.href).toBe(stepPathForRole('client', engagement, STEP));
    expect(d.href).toBe(`/app/client/incorporation/step/${d.href.split('/step/')[1]}`);
  });

  it.each(['intern', 'manager', 'admin'] as const)('checklist.submit opens the step for the %s', (role) => {
    const d = only(
      diffChecklistForNotifications({ [STEP]: { status: 'in-progress' } }, { [STEP]: { status: 'in-progress', clientSubmittedAt: AT, locked: true } }, { engagement, viewerRole: role, viewerUserId: 'u1' }),
      'checklist.submit',
    );
    expect(d.href).toBe(stepPathForRole(role, engagement, STEP));
    expect(d.href.endsWith(NOTIFIED_HASH)).toBe(true);
  });

  it.each(['client', 'intern', 'manager', 'admin'] as const)('a direct-flow submit opens the step for the %s', (role) => {
    const d = only(
      diffChecklistForNotifications({ [DIRECT]: { status: 'in-progress' } }, { [DIRECT]: { status: 'in-progress', clientSubmittedAt: AT } }, { engagement, viewerRole: role, viewerUserId: 'u1' }),
      'checklist.submit',
    );
    expect(d.href).toBe(stepPathForRole(role, engagement, DIRECT));
  });

  it.each(['accepted', 'rejected'] as const)('checklist.review (%s) opens the step for the client', (reviewStatus) => {
    const d = only(
      diffChecklistForNotifications({ [STEP]: { status: 'in-progress' } }, { [STEP]: { status: 'in-progress', reviewStatus, reviewedBy: 'm1' } }, { engagement, viewerRole: 'client', viewerUserId: 'c1' }),
      'checklist.review',
    );
    expect(d.href).toBe(stepPathForRole('client', engagement, STEP));
    expect(d.href).not.toBe('/app/client/incorporation');
  });

  it('docs.share opens the step for the client', () => {
    const d = only(
      diffChecklistForNotifications({ [STEP]: { status: 'in-progress' } }, { [STEP]: { status: 'in-progress', incorpDraftsSharedAt: AT } }, { engagement, viewerRole: 'client', viewerUserId: 'c1' }),
      'docs.share',
    );
    expect(d.href).toBe(stepPathForRole('client', engagement, STEP));
  });

  it('board resolution steps open the board resolution page', () => {
    const d = only(
      diffChecklistForNotifications({ 'pre-2': { status: 'in-progress' } }, { 'pre-2': { status: 'completed', deliveredToClientAt: AT } }, { engagement, viewerRole: 'client', viewerUserId: 'c1' }),
      'checklist.deliver',
    );
    expect(d.href).toBe(`/app/client/board-resolution${NOTIFIED_HASH}`);
  });

  it('Open uses the link a notification carries', () => {
    expect(notificationOpenHref({ href: '/app/lead/clients/acme/step/x#notified', engagementId: 'eng-1' }, 'intern')).toBe('/app/lead/clients/acme/step/x#notified');
  });

  it.each(['client', 'intern', 'manager', 'admin', 'super_admin'] as const)('an old notification without a link opens the project overview for the %s', (role) => {
    expect(notificationOpenHref({ href: '', engagementId: 'eng-1' }, role)).toBe(projectPathForRole(role, { id: 'eng-1', slug: 'eng-1' }));
    expect(notificationOpenHref({ href: '#', engagementId: 'eng-1' }, role)).not.toBeNull();
  });

  it('a notification with no link and no project has no Open', () => {
    expect(notificationOpenHref({ href: '', engagementId: '' }, 'admin')).toBeNull();
  });
});
