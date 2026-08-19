import { describe, expect, it } from 'vitest';
import {
  approvalCcEmails,
  collectManagerParties,
  emailsStaffViaResend,
  inAppIncludesActor,
  opensClientOutgoingDraft,
  staffEmailTargetsForEvent,
  type FanoutRecipients,
} from './engagement-event-fanout';

const lead = { userId: 'lead-1', email: 'intern@vcfo.local', name: 'Lead' };
const manager = { userId: 'mgr-1', email: 'manager@vcfo.local', name: 'PM' };
const coManager = { userId: 'mgr-2', email: 'comgr@vcfo.local', name: 'Co-PM' };
const client = { userId: 'cli-1', email: 'client@vcfo.local', name: 'Client' };

const hrefs = { leadHref: '/app/intern/step', managerHref: '/app/manager/step' };

function recipients(partial: Partial<FanoutRecipients> = {}): FanoutRecipients {
  return {
    client,
    clients: [client],
    lead,
    leads: [lead],
    manager,
    managers: [manager],
    admins: [],
    ...partial,
  };
}

describe('staffEmailTargetsForEvent', () => {
  it('emails lead and manager on client submit', () => {
    const targets = staffEmailTargetsForEvent('client_submitted', recipients(), hrefs);
    expect(targets.map((t) => t.label).sort()).toEqual(['lead', 'manager']);
    expect(targets.map((t) => t.email).sort()).toEqual([
      'intern@vcfo.local',
      'manager@vcfo.local',
    ]);
    expect(targets.find((t) => t.label === 'manager')?.href).toBe(hrefs.managerHref);
  });

  it('includes co-managers from membership even when primary manager is null', () => {
    const targets = staffEmailTargetsForEvent(
      'client_submitted',
      recipients({ manager: null, managers: [coManager, manager] }),
      hrefs,
    );
    expect(targets.filter((t) => t.label === 'manager').map((t) => t.email).sort()).toEqual([
      'comgr@vcfo.local',
      'manager@vcfo.local',
    ]);
  });

  it('still emails the manager when there is no lead', () => {
    const targets = staffEmailTargetsForEvent(
      'client_submitted',
      recipients({ lead: null, leads: [] }),
      hrefs,
    );
    expect(targets).toEqual([
      { email: 'manager@vcfo.local', href: hrefs.managerHref, label: 'manager' },
    ]);
  });

  it('does not treat a client address as staff', () => {
    const targets = staffEmailTargetsForEvent(
      'client_submitted',
      recipients({
        manager: { ...manager, email: client.email },
        managers: [{ ...manager, email: client.email }],
      }),
      hrefs,
    );
    expect(targets.map((t) => t.label)).toEqual(['lead']);
  });

  it('emails only managers when a lead requests manager approval', () => {
    const targets = staffEmailTargetsForEvent('lead_requested_review', recipients(), hrefs);
    expect(targets).toEqual([
      { email: 'manager@vcfo.local', href: hrefs.managerHref, label: 'manager' },
    ]);
  });
});

describe('collectManagerParties', () => {
  it('falls back to primary manager when managers[] is empty', () => {
    expect(collectManagerParties(recipients({ managers: [] })).map((p) => p.userId)).toEqual([
      'mgr-1',
    ]);
  });
});

describe('approvalCcEmails', () => {
  const admin = { userId: 'adm-1', email: 'admin@sbcllp.in', name: 'Admin' };

  it('CCs firm admins and leads, not the client', () => {
    expect(
      approvalCcEmails(
        recipients({
          admins: [admin],
        }),
      ).sort(),
    ).toEqual(['admin@sbcllp.in', 'intern@vcfo.local']);
  });

  it('drops excluded addresses', () => {
    expect(
      approvalCcEmails(recipients({ admins: [admin] }), {
        excludeEmails: ['intern@vcfo.local'],
      }),
    ).toEqual(['admin@sbcllp.in']);
  });

  it('includes engagement progress CC addresses', () => {
    expect(
      approvalCcEmails(
        recipients({
          admins: [admin],
          progressCc: ['extra@sbcllp.in', 'intern@vcfo.local'],
        }),
      ).sort(),
    ).toEqual(['admin@sbcllp.in', 'extra@sbcllp.in', 'intern@vcfo.local']);
  });
});

describe('channel rules', () => {
  it('uses Resend for client→staff and intern→manager, Graph compose for staff→client', () => {
    expect(emailsStaffViaResend('client_submitted')).toBe(true);
    expect(emailsStaffViaResend('lead_requested_review')).toBe(true);
    expect(opensClientOutgoingDraft('client_submitted')).toBe(false);
    expect(opensClientOutgoingDraft('lead_requested_review')).toBe(false);
    expect(opensClientOutgoingDraft('review_accepted')).toBe(true);
    expect(opensClientOutgoingDraft('board_resolution_shared')).toBe(true);
    expect(emailsStaffViaResend('review_accepted')).toBe(false);
    expect(emailsStaffViaResend('board_resolution_shared')).toBe(false);
  });

  it('writes a Received row for the acting lead on deliver and board-resolution share', () => {
    expect(inAppIncludesActor('delivered')).toBe(true);
    expect(inAppIncludesActor('board_resolution_shared')).toBe(true);
    expect(inAppIncludesActor('client_submitted')).toBe(false);
    expect(inAppIncludesActor('lead_requested_review')).toBe(false);
  });
});
