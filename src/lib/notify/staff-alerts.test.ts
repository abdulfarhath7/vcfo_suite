import { describe, expect, it } from 'vitest';
import { buildStaffAlertEmail, newlyAwaitingReview, staffAlertOn } from '@/lib/notify/staff-alerts';

describe('staff alerts', () => {
  it('counts a switch never saved as on', () => {
    expect(staffAlertOn(null, 'approvalsWaiting')).toBe(true);
    expect(staffAlertOn({ escalations: false }, 'escalations')).toBe(false);
    expect(staffAlertOn({ escalations: false }, 'approvalsWaiting')).toBe(true);
  });

  it('alerts only for steps that just started waiting', () => {
    const before = { a: { status: 'in-progress' }, b: { status: 'in-progress', reviewStatus: 'reviewing' } };
    const changes = [
      { stepId: 'a', reviewStatus: 'reviewing' },
      { stepId: 'b', reviewStatus: 'reviewing' },
      { stepId: 'c', reviewStatus: 'accepted' },
    ];
    expect(newlyAwaitingReview(before, changes)).toEqual(['a']);
  });

  it('writes plain approval and escalation emails with a link', () => {
    const a = buildStaffAlertEmail({ kind: 'approval', recipientName: 'Ravi Kumar', companyName: 'Acme', stepTitles: ['Name approval'], href: '/app/manager/approvals' });
    expect(a.subject).toBe('Acme: Name approval is waiting for your approval');
    expect(a.text).toContain('/app/manager/approvals');
    const e = buildStaffAlertEmail({ kind: 'escalation', recipientName: 'Meera', companyName: 'Acme', reason: 'Client unreachable', href: '/app/super/risks' });
    expect(e.subject).toBe('Escalation opened: Acme');
    expect(e.text).toContain('Client unreachable');
    for (const out of [a.text, e.text, a.html, e.html]) expect(out.toLowerCase()).not.toContain('please');
  });
});
