import { describe, expect, it } from 'vitest';
import type { PortalFiling } from './compliances';
import {
  filingTrack,
  filingWhat,
  groupsByDay,
  inPeriod,
  penaltyLine,
  periodAt,
  periodLabel,
  periodRange,
  stepPeriod,
  whoActs,
  worstOf,
} from './filing-track';

const TODAY = '2026-10-28';

function row(p: Partial<PortalFiling> = {}): PortalFiling {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    engagementId: 'e1',
    companyName: 'Acme India Pvt Ltd',
    particular: 'GSTR-3B Filing',
    name: 'GSTR-3B',
    area: 'GST',
    authority: 'GST',
    authorityName: 'GSTN',
    frequency: 'monthly',
    freqLabel: 'Monthly',
    dueDate: '2026-11-20',
    filedOn: null,
    period: 'Oct 2026',
    periodLong: null,
    fyLabel: null,
    rawStatus: 'pending',
    windowFrom: null,
    windowTo: null,
    penaltyRisk: 'high',
    ownerName: 'Asha',
    acknowledgementNo: null,
    amountPaid: null,
    filedByName: null,
    dataReceivedOn: null,
    preparingSince: null,
    draftDueOn: null,
    approvalDueOn: null,
    approvedOn: null,
    proofCount: 0,
    reminderOn: null,
    ...p,
  };
}

describe('filingTrack', () => {
  it('shows five steps, all not started, for a far filing with no recorded work', () => {
    const t = filingTrack(row(), 'Acme', TODAY);
    expect(t.map((s) => s.key)).toEqual(['data', 'prepare', 'draft', 'approve', 'file']);
    expect(t.every((s) => s.state === 'up')).toBe(true);
    expect(whoActs(row(), t)).toBe('You, then SBC');
  });

  it('marks the first open step now once SBC records work', () => {
    const f = row({ dataReceivedOn: '2026-10-20', preparingSince: '2026-10-21' });
    const t = filingTrack(f, 'Acme', TODAY);
    expect(t.map((s) => s.state)).toEqual(['done', 'now', 'up', 'up', 'up']);
    expect(whoActs(f, t)).toBe('SBC');
  });

  it('a passed draft date completes preparing and the draft; approval is next', () => {
    const f = row({ draftDueOn: '2026-10-25', approvalDueOn: '2026-11-02' });
    const t = filingTrack(f, 'Acme', TODAY);
    expect(t.map((s) => s.state)).toEqual(['done', 'done', 'done', 'now', 'up']);
    expect(t[3]!.title).toBe('Acme approves the figures');
    expect(t[3]!.body).toContain('2 Nov 2026');
  });

  it('an overdue filing is stuck on its open step', () => {
    const f = row({ dueDate: '2026-10-20' });
    const t = filingTrack(f, 'Acme', TODAY);
    expect(t[0]!.state).toBe('stuck');
    expect(t[0]!.sub).toContain('8 days ago');
  });

  it('a filed filing is done everywhere and names who filed it', () => {
    const f = row({ filedOn: '2026-10-18', filedByName: 'Ravi', acknowledgementNo: 'AA36' });
    const t = filingTrack(f, 'Acme', TODAY);
    expect(t.every((s) => s.state === 'done')).toBe(true);
    expect(t[4]!.body).toContain('AA36');
    expect(whoActs(f, t)).toBe('Ravi · SBC');
  });
});

describe('penaltyLine / filingWhat', () => {
  it('uses the penalty risk and the lateness', () => {
    expect(penaltyLine(row(), TODAY)).toMatch(/^High penalty risk/);
    expect(penaltyLine(row({ dueDate: '2026-10-27', penaltyRisk: 'low' }), TODAY)).toMatch(/^1 day late\. Low/);
    expect(penaltyLine(row({ filedOn: '2026-10-01' }), TODAY)).toBeNull();
  });
  it('describes the filing from its register facts', () => {
    expect(filingWhat(row())).toContain('GSTR-3B for Oct 2026 is a monthly filing with the GSTN');
    expect(filingWhat(row({ freqLabel: 'Annual' }))).toContain('is an annual filing');
  });
});

describe('periods', () => {
  it('finds the period containing today', () => {
    expect(periodAt('month', TODAY)).toEqual({ gran: 'month', fy: 2026, idx: 6 });
    expect(periodAt('quarter', '2027-02-10')).toEqual({ gran: 'quarter', fy: 2026, idx: 3 });
  });
  it('labels and ranges', () => {
    expect(periodLabel({ gran: 'quarter', fy: 2026, idx: 3 })).toBe('Q4 · Jan–Mar 2027');
    expect(periodRange({ gran: 'quarter', fy: 2026, idx: 3 })).toEqual({ from: '2027-01-01', to: '2027-03-31' });
    expect(periodRange({ gran: 'month', fy: 2026, idx: 10 })).toEqual({ from: '2027-02-01', to: '2027-02-28' });
    expect(inPeriod({ gran: 'year', fy: 2026, idx: 0 }, '2027-03-31')).toBe(true);
  });
  it('steps across financial years', () => {
    expect(stepPeriod({ gran: 'month', fy: 2026, idx: 0 }, -1)).toEqual({ gran: 'month', fy: 2025, idx: 11 });
    expect(stepPeriod({ gran: 'quarter', fy: 2026, idx: 3 }, 1)).toEqual({ gran: 'quarter', fy: 2027, idx: 0 });
    expect(stepPeriod({ gran: 'year', fy: 2026, idx: 0 }, -1)).toEqual({ gran: 'year', fy: 2025, idx: 0 });
  });
});

describe('groupsByDay / worstOf', () => {
  it('groups per due date with the worst status first', () => {
    const a = row({ id: 'a', name: 'B', dueDate: '2026-10-20' });
    const b = row({ id: 'b', name: 'A', dueDate: '2026-10-20', filedOn: '2026-10-19' });
    const c = row({ id: 'c', dueDate: '2026-11-20' });
    const g = groupsByDay([c, b, a], TODAY);
    expect(g.map((x) => x.d)).toEqual(['2026-10-20', '2026-11-20']);
    expect(g[0]!.lead.id).toBe('a');
    expect(g[0]!.st).toBe('over');
    expect(worstOf([], TODAY)).toBe('ok');
  });
});

describe('fyRange', () => {
  it('spans the register and always the current and next FY', async () => {
    const { fyRange } = await import('./filing-track');
    expect(fyRange([], 2026)).toEqual({ lo: 2026, hi: 2027 });
    expect(fyRange([{ dueDate: '2026-03-31' }, { dueDate: '2028-06-15' }], 2026)).toEqual({ lo: 2025, hi: 2028 });
  });
});
