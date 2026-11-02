import { describe, expect, it } from 'vitest';
import type { Engagement } from '@/data/engagements';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import { listPendingApprovals } from '@/lib/pending-approvals';
import type { TimelineRequestDto } from '@/lib/client-home';
import type { BookTimelineRequest } from '@/lib/timeline-request-history';
import { buildApprovals, buildDateRequests, countPendingTimelineRequests, kindOf, slipText, visibleInInbox } from './model';

const TODAY = '2026-10-29';
const ME = 'mgr-1';

function eng(id: string, name: string, extra: Partial<Engagement> = {}): Engagement {
  return {
    id,
    slug: `demo-${id}`,
    clientId: `c-${id}`,
    companyName: name,
    companyType: 'domestic',
    internId: 'lead-a',
    leadIds: ['lead-a'],
    adminId: 'admin',
    managerId: ME,
    createdAt: '2026-09-02',
    stage: 'Pre-Incorporation',
    health: 'on-track',
    clientDisplayName: 'Kiran Rao',
    ...extra,
  };
}
type State = Record<string, ChecklistItemStateSlice>;
const done = (d: string): ChecklistItemStateSlice => ({ status: 'completed', completedOn: d });

const north = eng('n', 'Northwind Analytics India Pvt Ltd');
const kes = eng('k', 'Kestrel Robotics India Pvt Ltd', { stage: 'Post-Incorporation', incorporationDate: '2026-09-30' });
const other = eng('o', 'Other Manager Co Pvt Ltd', { managerId: 'mgr-2' });

const states: Record<string, State> = {
  n: {
    'pre-1': done('2026-09-10'),
    'pre-2': { status: 'in-progress', reviewStatus: 'reviewing', reviewSource: 'lead_manager_request', locked: true, clientSubmittedAt: '2026-10-26T06:00:00Z' },
  },
  k: {
    'post-1': {
      status: 'in-progress',
      clientFillRequest: { status: 'pending_manager', requestedBy: 'u-lead', requestedByName: 'Ananya Rao', requestedAt: '2026-10-28T04:00:00Z', note: 'Bank details please' },
    },
    'post-3': { status: 'completed', reviewStatus: 'accepted', reviewSource: 'client_submission', reviewedAt: '2026-10-20T05:00:00Z', reviewedBy: ME },
    'post-4': { status: 'in-progress', reviewStatus: 'rejected', reviewSource: 'lead_manager_request', reviewedAt: '2026-10-21T05:00:00Z', reviewedBy: 'mgr-9', rejectionNote: 'Wrong PAN' },
    // a client's change request writes the reject shape: not a decision of the firm
    'post-5': {
      status: 'in-progress',
      reviewStatus: 'rejected',
      reviewedAt: '2026-10-22T05:00:00Z',
      reviewedBy: 'client-1',
      approval: { state: 'change_requested', changeRequestedAt: '2026-10-22T05:00:00Z' },
    },
    // too old for the Decided tab
    'post-6': { status: 'completed', reviewStatus: 'accepted', reviewedAt: '2026-08-01T05:00:00Z', reviewedBy: ME },
    'post-2': {
      status: 'awaiting-client',
      clientFillRequest: { status: 'declined', requestedBy: 'u-lead', requestedByName: 'Ananya Rao', requestedAt: '2026-10-10T04:00:00Z', decidedBy: ME, decidedAt: '2026-10-11T04:00:00Z', decisionNote: 'Not yet' },
    },
  },
  o: { 'pre-2': { status: 'in-progress', reviewStatus: 'accepted', reviewedAt: '2026-10-25T05:00:00Z', reviewedBy: 'mgr-2' } },
};
const stateFor = (e: Engagement) => states[e.id];
const engagements = [north, kes, other];
const rows = listPendingApprovals([north, kes], (e) => states[e.id] ?? {});
const people = [{ id: 'lead-a', name: 'Ananya Rao' }];
const me = { id: ME, role: 'manager' };

describe('approvals', () => {
  it('reads the kind the way the live inbox labels it', () => {
    expect(kindOf({ itemId: 'pre-2', reviewSource: 'lead_manager_request' })).toBe('board');
    expect(kindOf({ itemId: 'post-1', clientFill: {} })).toBe('fill');
    expect(kindOf({ itemId: 'post-3', reviewSource: 'lead_manager_request' })).toBe('lead');
    expect(kindOf({ itemId: 'post-3' })).toBe('client');
  });

  it('turns every live row into a waiting card with who sent it and since when', () => {
    const m = buildApprovals({ rows, engagements, stateFor, people, me, today: TODAY, scope: 'all' });
    expect(m.waiting.map((w) => [w.e.id, w.itemId, w.kind])).toEqual(
      expect.arrayContaining([
        ['n', 'pre-2', 'board'],
        ['k', 'post-1', 'fill'],
      ]),
    );
    const board = m.waiting.find((w) => w.kind === 'board')!;
    expect(board.from).toEqual({ name: 'Ananya Rao', role: 'project lead' });
    expect(board.since).toBe('2026-10-26');
    expect(board.days).toBe(3);
    const fill = m.waiting.find((w) => w.kind === 'fill')!;
    expect(fill.note).toBe('Bank details please');
    expect(fill.days).toBe(1);
    expect(m.all.waiting).toBe(rows.length);
  });

  it('lists the latest decisions of the last 30 days, not a client’s change request', () => {
    const m = buildApprovals({ rows, engagements, stateFor, people, me, today: TODAY, scope: 'all' });
    const ids = m.decided.map((d) => d.id);
    expect(ids).toContain('k:post-3:review');
    expect(ids).toContain('k:post-4:review');
    expect(ids).toContain('k:post-2:fill');
    expect(ids).not.toContain('k:post-5:review');
    expect(ids).not.toContain('k:post-6:review');
    // another manager's project stays out, as in the live inbox
    expect(ids.some((id) => id.startsWith('o:'))).toBe(false);
    const accepted = m.decided.find((d) => d.id === 'k:post-3:review')!;
    expect(accepted).toMatchObject({ kind: 'client', ok: true, label: 'Accepted', by: 'You' });
    const rejected = m.decided.find((d) => d.id === 'k:post-4:review')!;
    expect(rejected).toMatchObject({ kind: 'lead', ok: false, label: 'Rejected', note: 'Wrong PAN', by: undefined });
    expect(m.decided.find((d) => d.id === 'k:post-2:fill')).toMatchObject({ ok: false, label: 'Declined', note: 'Not yet', by: 'You' });
    // newest first
    expect(ids.indexOf('k:post-4:review')).toBeLessThan(ids.indexOf('k:post-3:review'));
  });

  it('follows the Stage filter and keeps the unfiltered counts', () => {
    const m = buildApprovals({ rows, engagements, stateFor, people, me, today: TODAY, scope: 'inc' });
    expect(m.waiting.every((w) => w.stage === 'inc')).toBe(true);
    expect(m.waiting.length).toBeLessThan(m.all.waiting);
    expect(m.decided).toEqual([]);
  });

  it('uses the live visibility rule for a manager', () => {
    expect(visibleInInbox({ managerId: 'mgr-2' }, me)).toBe(false);
    expect(visibleInInbox({ managerId: ME }, me)).toBe(true);
    expect(visibleInInbox({ managerId: 'mgr-2' }, { id: 'x', role: 'super_admin' })).toBe(true);
  });
});

describe('date requests', () => {
  const pending: TimelineRequestDto = {
    id: 'tr-1',
    reason: 'Directors are travelling',
    status: 'pending',
    phases: [
      { id: 'p1', name: 'Phase 1 · Name Application', from: '2026-09-02', to: '2026-10-05' },
      { id: 'coi', name: 'COI', from: '2026-11-20', to: '2026-11-20' },
    ],
    coiFrom: '2026-11-10',
    coiTo: '2026-11-20',
    slipDays: 10,
    createdAt: '2026-10-27T06:00:00Z',
    requestedByName: 'Kiran Rao',
  };
  const lists = { n: [pending, { ...pending, id: 'tr-0', status: 'withdrawn' as const }], k: [] };
  const closed: BookTimelineRequest[] = [
    {
      id: 'tr-9',
      engagementId: 'k',
      status: 'approved',
      reason: 'Bank holiday',
      phases: [{ id: 'coi', name: 'COI', from: '2026-09-30', to: '2026-09-30' }],
      coiFrom: '2026-09-25',
      coiTo: '2026-09-30',
      slipDays: 5,
      createdAt: '2026-10-01T06:00:00Z',
      updatedAt: '2026-10-02T06:00:00Z',
      decidedAt: '2026-10-02T06:00:00Z',
      decidedBy: ME,
      decisionNote: 'Fine',
    },
  ];

  it('lists each pending request with the plan it would change', () => {
    const m = buildDateRequests({ engagements, stateFor, lists, closed, meId: ME, today: TODAY, scope: 'all' });
    expect(m.waiting).toHaveLength(1);
    const w = m.waiting[0]!;
    expect(w).toMatchObject({ id: 'tr-1', who: 'Kiran Rao', sent: '2026-10-27' });
    expect(w.phases.map((p) => p.id)).toEqual(['p1', 'coi']);
    expect(w.phases[1]!.milestone).toBe(true);
    expect(w.slip).toBe(10);
  });

  it('maps the closed ones and says who decided', () => {
    const m = buildDateRequests({ engagements, stateFor, lists, closed, meId: ME, today: TODAY, scope: 'all' });
    expect(m.decided).toHaveLength(1);
    expect(m.decided[0]).toMatchObject({ result: 'ok', by: 'You', note: 'Fine', slip: 5 });
  });

  it('follows the Stage filter; the badge counts the whole book', () => {
    const m = buildDateRequests({ engagements, stateFor, lists, closed, meId: ME, today: TODAY, scope: 'cmp' });
    expect(m.waiting).toHaveLength(0);
    expect(m.all.waiting).toBe(1);
    expect(m.decided).toHaveLength(1);
    expect(countPendingTimelineRequests(lists)).toBe(1);
  });

  it('words the slip', () => {
    expect(slipText(0)).toBe('no change');
    expect(slipText(1)).toBe('slips 1 day');
    expect(slipText(-3)).toBe('3 days earlier');
  });
});
