import { describe, expect, it } from 'vitest';
import type { PortalFiling } from '@/lib/client-portal/compliances';
import type { ClientHome } from '@/lib/client-home';
import type { PortalIncorporationModel, PortalStep } from '@/lib/client-portal/step-model';
import { briefText, buildDock, cityOf, companySubLine, dueWithin, groupsOf, nextDeadlineOf, overdueOf, readyBy, stageLabel } from './model';

const TODAY = '2026-10-28';

function filing(p: Partial<PortalFiling> & { id: string; dueDate: string }): PortalFiling {
  return {
    engagementId: 'e',
    companyName: 'Halcyon Payments India Pvt Ltd',
    particular: p.name ?? p.id,
    name: p.id,
    area: 'IT',
    authority: 'IT',
    authorityName: 'Income Tax Dept',
    frequency: 'quarterly',
    freqLabel: 'Quarterly',
    filedOn: null,
    period: 'Jul–Sep 2026',
    periodLong: null,
    fyLabel: null,
    rawStatus: 'upcoming',
    windowFrom: null,
    windowTo: null,
    penaltyRisk: 'medium',
    ownerName: 'Sneha Kulkarni',
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

function step(p: Partial<PortalStep> & { id: string; n: number }): PortalStep {
  return {
    title: `Step ${p.n}`,
    item: { id: p.id } as PortalStep['item'],
    phaseId: 'post-inc-phase-3',
    phaseNo: 3,
    owner: 'client',
    kind: 'up',
    late: false,
    lateDays: 0,
    gate: { kind: 'locked', canOpen: false } as unknown as PortalStep['gate'],
    canOpen: false,
    ...p,
  };
}

function model(steps: PortalStep[], extra: Partial<PortalIncorporationModel> = {}): PortalIncorporationModel {
  const done = steps.filter((s) => s.kind === 'done').length;
  return {
    phases: [],
    steps,
    byId: Object.fromEntries(steps.map((s) => [s.id, s])),
    spice: { done: 0, total: 0, pct: 0 },
    all: { done, total: steps.length, pct: steps.length ? Math.round((done / steps.length) * 100) : 0 },
    counts: { done, you: 0, prog: 0, with: 0, next: 0, up: 0, late: 0 },
    ...extra,
  };
}

const ROWS = [
  filing({ id: 'Advance tax Q2', dueDate: '2026-09-15', rawStatus: 'overdue' }),
  filing({ id: 'DIR-3 KYC', dueDate: '2026-09-30', filedOn: '2026-09-30', area: 'MCA' }),
  filing({ id: 'MSME-1', dueDate: '2026-10-31', area: 'MCA' }),
  filing({ id: 'GSTR-3B', dueDate: '2026-10-31', area: 'GST' }),
  filing({ id: 'Advance tax Q3', dueDate: '2026-12-15' }),
];

describe('home filings', () => {
  it('splits overdue, next deadline and the 14-day window by today', () => {
    expect(overdueOf(ROWS, TODAY).map((r) => r.id)).toEqual(['Advance tax Q2']);
    expect(nextDeadlineOf(ROWS, TODAY)?.id).toBe('MSME-1');
    expect(dueWithin(ROWS, TODAY, 14).map((r) => r.id)).toEqual(['MSME-1', 'GSTR-3B']);
  });

  it('groups orbit ticks per law and date, worst status leading', () => {
    const g = groupsOf(ROWS, TODAY);
    expect(g).toHaveLength(5);
    const mca = g.find((x) => x.law === 'MCA' && x.d === '2026-10-31')!;
    expect(mca.items).toHaveLength(1);
    expect(g.find((x) => x.d === '2026-09-15')!.st).toBe('over');
    expect(g.find((x) => x.d === '2026-09-30')!.st).toBe('ok');
  });
});

describe('company strip', () => {
  it('reads the city from the registered office and only says what exists', () => {
    expect(cityOf('WeWork Prestige Central, Bengaluru 560001')).toBe('Bengaluru');
    expect(cityOf('12 MG Road, Bengaluru, Karnataka')).toBe('Bengaluru · Karnataka');
    expect(cityOf(undefined)).toBeUndefined();
    expect(companySubLine({ legalForm: 'company', registeredOffice: 'WeWork Prestige Central, Bengaluru 560001', parentEntityName: 'Halcyon Payments Pte Ltd, Singapore' })).toBe(
      'Private Limited · Bengaluru · subsidiary of Halcyon Payments Pte Ltd, Singapore',
    );
    expect(companySubLine({ legalForm: 'llp' })).toBe('LLP');
    expect(companySubLine(null)).toBe('');
  });

  it('names the stage and the ready-by date from the phases', () => {
    const m = model([], {
      phases: [
        { no: 1, id: 'a', name: 'SPICe+ Part A', title: '', section: '', steps: [], done: 3, total: 3, state: 'done' },
        { no: 2, id: 'b', name: 'SPICe+ Part B', title: '', section: '', steps: [], done: 3, total: 3, state: 'done' },
        { no: 3, id: 'c', name: 'Post-incorporation', title: '', section: '', steps: [], done: 1, total: 4, state: 'active', end: '2026-12-10' },
        { no: 4, id: 'd', name: 'Registration', title: '', section: '', steps: [], done: 0, total: 6, state: 'active', end: '2027-01-15' },
      ],
    });
    expect(stageLabel(m)).toBe('Phase 3 → 4');
    expect(readyBy(m, TODAY)).toBe('2027-01-15');
    m.phases[3]!.state = 'up';
    expect(stageLabel(m)).toBe('Phase 3 · Post-incorporation');
    expect(readyBy(m, TODAY)).toBe('2027-01-15');
    expect(stageLabel(model([]))).toBeUndefined();
  });
});

describe('the dock', () => {
  const home = {
    needs: [
      { id: 'r1', title: 'Notarised lease deed', kind: 'upload', stepId: 'reg-9', dueDate: '2026-10-10', createdAt: '2026-10-01T00:00:00Z' },
      { id: 'r2', title: 'Bank statement for the quarter', kind: 'upload', complianceInstanceId: 'Advance tax Q2', createdAt: '2026-10-01T00:00:00Z' },
    ],
    filings: { fyLabel: 'FY 2026-27', fyStartYear: 2026, rows: [{ id: 'Advance tax Q2', title: 'Advance tax Q2', authority: 'IT', dueDate: '2026-09-15', status: 'overdue', owner: 'client', hasProof: false }] },
  } as unknown as ClientHome;

  it('lists requests, client steps and client-owned overdue filings, overdue first, without doubles', () => {
    const m = model([
      step({ id: 'reg-9', n: 20, title: 'Shops & Establishment', kind: 'you', due: '2026-11-12' }),
      step({ id: 'post-3', n: 15, title: 'Open the bank account', kind: 'you', due: '2026-11-05' }),
      step({ id: 'post-1', n: 13, title: 'First board meeting', kind: 'done' }),
    ]);
    const dock = buildDock(m, home, ROWS, TODAY);
    // overdue first, oldest date first; the step waits behind them
    expect(dock.map((x) => x.key)).toEqual(['req:r2', 'req:r1', 'step:post-3']);
    expect(dock[1]).toMatchObject({ sev: 'over', tag: 'Overdue since 10 Oct · Shops & Establishment', open: { kind: 'request', requestId: 'r1', stepId: 'reg-9' } });
    // the request linked to the overdue filing takes the filing's date and stands in for it
    expect(dock[0]).toMatchObject({ sev: 'over', due: '2026-09-15', open: { kind: 'request', requestId: 'r2' } });
    expect(dock[2]).toMatchObject({ sev: 'you', tag: 'Due 5 Nov · in 8 days', open: { kind: 'step', stepId: 'post-3' } });
  });

  it('adds a client-owned overdue filing when no request covers it', () => {
    const h = { ...home, needs: [] } as ClientHome;
    const dock = buildDock(model([]), h, ROWS, TODAY);
    expect(dock).toHaveLength(1);
    expect(dock[0]).toMatchObject({ need: 'filing', sev: 'over', open: { kind: 'filing', filingId: 'Advance tax Q2' } });
  });

  it('is empty with nothing waiting', () => {
    expect(buildDock(model([step({ id: 'x', n: 1, kind: 'with' })]), null, ROWS, TODAY)).toEqual([]);
  });
});

describe('status brief', () => {
  it('writes every line from the data', () => {
    const m = model([step({ id: 'a', n: 1, kind: 'done' }), step({ id: 'b', n: 2, kind: 'you', title: 'Bank account', due: '2026-11-05' })], {
      phases: [
        { no: 1, id: 'a', name: 'SPICe+ Part A', title: '', section: '', steps: [], done: 1, total: 1, state: 'done' },
        { no: 3, id: 'c', name: 'Post-incorporation', title: '', section: '', steps: [], done: 0, total: 1, state: 'active', end: '2026-12-10' },
      ],
    });
    const dock = buildDock(m, null, ROWS, TODAY);
    const t = briefText({
      companyName: 'Halcyon Payments India Pvt Ltd',
      companyShort: 'Halcyon',
      model: m,
      rows: ROWS,
      dock,
      team: [
        { name: 'Joseph Mathew', role: 'Project Manager' },
        { name: 'Customer support', role: 'SBC help desk', support: true },
      ],
      today: TODAY,
    });
    expect(t).toContain('Halcyon Payments India Pvt Ltd: status as of Wed 28 Oct 2026.');
    expect(t).toContain('Set-up: 1 of 2 steps done. SPICe+ Part A is complete; Post-incorporation is under way. Expected to be fully registered by Thu 10 Dec 2026.');
    expect(t).toContain('Overdue (1): Advance tax Q2 for Jul–Sep 2026 was due on Tue 15 Sep 2026 · Sneha Kulkarni at SBC.');
    expect(t).toContain('Waiting on Halcyon (1): Bank account.');
    expect(t).toContain('Due in the next 14 days: MSME-1 (31 Oct); GSTR-3B (31 Oct). SBC prepares and files these.');
    expect(t).toContain('Filed this financial year (FY 2026-27): 1 filing, all on time.');
    expect(t).toContain('SBC team: Joseph Mathew (Project Manager).');
    expect(t).not.toContain('Customer support');
  });

  it('says so plainly when nothing is overdue or waiting', () => {
    const t = briefText({ companyName: 'X', companyShort: 'X', model: model([]), rows: [], dock: [], team: [], today: TODAY });
    expect(t).toContain('Nothing is overdue.');
    expect(t).toContain('Nothing is waiting on X.');
    expect(t).toContain('Filed this financial year (FY 2026-27): 0 filings.');
  });
});
