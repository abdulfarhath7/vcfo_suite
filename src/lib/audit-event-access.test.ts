import { describe, expect, it } from 'vitest';
import {
  auditEventVisibleToViewer,
  canQueryAuditEngagement,
  filterAuditEventsForViewer,
  type AuditEventAccessRow,
} from '@/lib/audit-event-access';

const internA = 'user-intern-a';
const internB = 'user-intern-b';
const managerA = 'user-manager-a';
const managerB = 'user-manager-b';
const admin = 'user-admin';

const shared = 'eng-shared';
const internAOnly = 'eng-intern-a';
const internBOnly = 'eng-intern-b';
const managerAClient = 'eng-manager-a';
const managerBClient = 'eng-manager-b';

function event(
  actorUserId: string,
  engagementId: string | null,
): AuditEventAccessRow {
  return { actorUserId, engagementId };
}

const catalog: AuditEventAccessRow[] = [
  event(internA, null),
  event(internA, internAOnly),
  event(internA, internBOnly),
  event(internB, shared),
  event(internB, internBOnly),
  event(internB, null),
  event(managerA, managerAClient),
  event(managerB, managerBClient),
  event(managerA, managerBClient),
  event(admin, null),
  event(admin, shared),
];

describe('intern audit visibility (Path A)', () => {
  const internAScope = [shared, internAOnly];

  it('shows own actor rows even with null engagement or an unassigned client', () => {
    expect(
      auditEventVisibleToViewer({
        role: 'intern',
        userId: internA,
        scopedEngagementIds: internAScope,
        event: event(internA, null),
      }),
    ).toBe(true);
    expect(
      auditEventVisibleToViewer({
        role: 'intern',
        userId: internA,
        scopedEngagementIds: internAScope,
        event: event(internA, internBOnly),
      }),
    ).toBe(true);
  });

  it('shows another intern’s events on a shared client and hides disjoint-client events', () => {
    expect(
      auditEventVisibleToViewer({
        role: 'intern',
        userId: internA,
        scopedEngagementIds: internAScope,
        event: event(internB, shared),
      }),
    ).toBe(true);
    expect(
      auditEventVisibleToViewer({
        role: 'intern',
        userId: internA,
        scopedEngagementIds: internAScope,
        event: event(internB, internBOnly),
      }),
    ).toBe(false);
  });

  it('hides peer / admin unscoped noise', () => {
    expect(
      auditEventVisibleToViewer({
        role: 'intern',
        userId: internA,
        scopedEngagementIds: internAScope,
        event: event(internB, null),
      }),
    ).toBe(false);
    expect(
      auditEventVisibleToViewer({
        role: 'intern',
        userId: internA,
        scopedEngagementIds: internAScope,
        event: event(admin, null),
      }),
    ).toBe(false);
  });

  it('still shows admin (or anyone) activity that is tied to a shared client', () => {
    expect(
      auditEventVisibleToViewer({
        role: 'intern',
        userId: internA,
        scopedEngagementIds: internAScope,
        event: event(admin, shared),
      }),
    ).toBe(true);
  });

  it('filters a mixed catalog the way the repository SQL must', () => {
    const visible = filterAuditEventsForViewer({
      role: 'intern',
      userId: internA,
      scopedEngagementIds: internAScope,
      events: catalog,
    });
    expect(visible).toEqual([
      event(internA, null),
      event(internA, internAOnly),
      event(internA, internBOnly),
      event(internB, shared),
      event(admin, shared),
    ]);
  });

  it('does not let a project query leak own events from another client', () => {
    expect(canQueryAuditEngagement('intern', internAScope, internBOnly)).toBe(false);
    expect(
      filterAuditEventsForViewer({
        role: 'intern',
        userId: internA,
        scopedEngagementIds: internAScope,
        requestedEngagementId: internBOnly,
        events: catalog,
      }),
    ).toEqual([]);
    expect(
      filterAuditEventsForViewer({
        role: 'intern',
        userId: internA,
        scopedEngagementIds: internAScope,
        requestedEngagementId: shared,
        events: catalog,
      }),
    ).toEqual([event(internB, shared), event(admin, shared)]);
  });
});

describe('manager audit visibility (Path A)', () => {
  const managerAScope = [managerAClient, shared];

  it('shows events on owned/assigned clients only — not own actor on another manager’s client', () => {
    expect(
      auditEventVisibleToViewer({
        role: 'manager',
        userId: managerA,
        scopedEngagementIds: managerAScope,
        event: event(internB, shared),
      }),
    ).toBe(true);
    expect(
      auditEventVisibleToViewer({
        role: 'manager',
        userId: managerA,
        scopedEngagementIds: managerAScope,
        event: event(managerB, managerBClient),
      }),
    ).toBe(false);
    expect(
      auditEventVisibleToViewer({
        role: 'manager',
        userId: managerA,
        scopedEngagementIds: managerAScope,
        event: event(managerA, managerBClient),
      }),
    ).toBe(false);
  });

  it('drops unscoped rows even when the manager is the actor', () => {
    expect(
      auditEventVisibleToViewer({
        role: 'manager',
        userId: managerA,
        scopedEngagementIds: managerAScope,
        event: event(managerA, null),
      }),
    ).toBe(false);
    expect(
      auditEventVisibleToViewer({
        role: 'manager',
        userId: managerA,
        scopedEngagementIds: managerAScope,
        event: event(admin, null),
      }),
    ).toBe(false);
  });

  it('filters a mixed catalog to own clients', () => {
    const visible = filterAuditEventsForViewer({
      role: 'manager',
      userId: managerA,
      scopedEngagementIds: managerAScope,
      events: catalog,
    });
    expect(visible).toEqual([
      event(internB, shared),
      event(managerA, managerAClient),
      event(admin, shared),
    ]);
  });

  it('rejects a project query for another manager’s client', () => {
    expect(canQueryAuditEngagement('manager', managerAScope, managerBClient)).toBe(
      false,
    );
    expect(
      filterAuditEventsForViewer({
        role: 'manager',
        userId: managerA,
        scopedEngagementIds: managerAScope,
        requestedEngagementId: managerBClient,
        events: catalog,
      }),
    ).toEqual([]);
  });
});

describe('admin / super_admin audit visibility', () => {
  it('sees firm-wide rows including unscoped admin noise', () => {
    expect(
      filterAuditEventsForViewer({
        role: 'admin',
        userId: admin,
        scopedEngagementIds: [],
        events: catalog,
      }),
    ).toEqual(catalog);
    expect(
      filterAuditEventsForViewer({
        role: 'super_admin',
        userId: admin,
        scopedEngagementIds: [],
        events: catalog,
      }),
    ).toEqual(catalog);
  });

  it('may still filter by engagement without an assignment check', () => {
    expect(canQueryAuditEngagement('admin', [], internBOnly)).toBe(true);
    expect(
      filterAuditEventsForViewer({
        role: 'super_admin',
        userId: admin,
        scopedEngagementIds: [],
        requestedEngagementId: internBOnly,
        events: catalog,
      }),
    ).toEqual([event(internA, internBOnly), event(internB, internBOnly)]);
  });
});
