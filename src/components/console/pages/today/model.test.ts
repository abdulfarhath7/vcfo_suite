import { describe, expect, it } from 'vitest';
import type { DocRequest, Engagement, TaskInstance } from '@/data/engagements';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import type { FilingRow } from '@/lib/compliance/filings';
import type { PendingApprovalRow } from '@/lib/projects/pending-approvals';
import { buildToday, datedItems, filingName, filingSt, isoWeek, phaseSpan, weekOf, type TodayInput } from './model';

/**
 * Manager Today — the lists every panel counts from. Fixtures follow the demo
 * book: three incorporating clients at different steps and one compliance
 * client with every step done and filings in the register.
 */

const TODAY = '2026-10-29'; // a Thursday
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
    ...extra,
  };
}

type State = Record<string, ChecklistItemStateSlice>;
const done = (d: string): ChecklistItemStateSlice => ({ status: 'completed', completedOn: d });

const ALL_STEPS = [
  'pre-1', 'pre-2', 'pre-3', 'pre-4', 'pre-5', 'pre-13', 'pre-14', 'pre-15', 'pre-16', 'pre-7', 'pre-9', 'pre-10', 'pre-11', 'pre-12',
  'post-1', 'post-9', 'post-3', 'post-4', 'post-5', 'post-6', 'post-2', 'post-7', 'post-8', 'post-11', 'post-10',
  'reg-4', 'reg-1', 'reg-3', 'reg-7', 'reg-6', 'reg-15', 'reg-16', 'reg-8', 'reg-5', 'reg-11', 'reg-9', 'reg-13', 'reg-14', 'reg-10', 'reg-12', 'reg-17', 'reg-18', 'reg-19', 'reg-20', 'reg-21', 'reg-22', 'reg-23', 'reg-24',
];

const kestrel = eng('k', 'Kestrel Robotics India Pvt Ltd', { internId: 'lead-d', leadIds: ['lead-d'] });
const northwind = eng('n', 'Northwind Analytics India Pvt Ltd', { createdAt: '2026-09-28' });
const quarry = eng('q', 'Quarry Digital India Pvt Ltd', { internId: 'lead-s', leadIds: ['lead-s'], createdAt: '2026-10-14' });
const solstice = eng('s', 'Solstice Energy India Pvt Ltd', {
  internId: 'lead-d',
  leadIds: ['lead-d'],
  stage: 'Operational Readiness',
  incorporationDate: '2025-10-31',
  createdAt: '2025-09-11',
});

const states: Record<string, State> = {
  k: {
    'pre-1': done('2026-09-02'),
    'pre-2': done('2026-09-07'),
    'pre-3': done('2026-09-12'),
    'pre-4': done('2026-09-17'),
    'pre-5': done('2026-09-22'),
    'pre-13': done('2026-09-27'),
    'pre-14': done('2026-10-02'),
    'pre-15': done('2026-10-07'),
    'pre-16': { status: 'in-progress', locked: true, reviewSource: 'client_submission', reviewStatus: 'reviewing', clientSubmittedAt: '2026-10-12T11:44:44.694Z' },
  },
  n: { 'pre-1': done('2026-09-28'), 'pre-2': done('2026-10-05'), 'pre-3': { status: 'in-progress' } },
  q: { 'pre-1': { status: 'in-progress' } },
  s: Object.fromEntries(ALL_STEPS.map((id) => [id, done(id === 'reg-24' ? '2026-10-27' : '2026-10-04')])),
};

function filing(id: string, particular: string, due: string, filedOn: string | null = null, extra: Partial<FilingRow> = {}): FilingRow {
  return {
    id,
    engagementId: 's',
    companyName: solstice.companyName,
    compliance: 'Companies Act, 2013',
    particular,
    authority: 'MCA',
    frequency: 'annual',
    dueDate: due,
    filedOn,
    periodLabel: null,
    fyLabel: null,
    rawStatus: filedOn ? 'filed' : 'upcoming',
    obligationId: `o-${id}`,
    windowFrom: null,
    windowTo: null,
    ...extra,
  };
}

const filings: FilingRow[] = [
  filing('f1', 'Director KYC (DIR-3 KYC)', '2026-09-30'),
  filing('f2', 'Advance Tax Payment Q1', '2026-06-15', null, { compliance: 'Income Tax', authority: 'IT', periodLabel: 'Advance Tax Payment Q1 2026' }),
  filing('f3', 'Form AOC-4', '2026-10-30'),
  filing('f4', 'MSME-1 Filing (Apr–Sep)', '2026-10-31'),
  filing('f5', 'Form MGT-7', '2026-11-29'),
  filing('f6', 'DPT-3 Filing', '2026-06-30', '2026-06-30'),
  filing('f7', 'Income Tax Return Filing', '2026-10-10', '2026-10-27', { compliance: 'Income Tax', authority: 'IT', periodLabel: 'ITR FY 2025-26' }),
  filing('f8', 'Advance Tax Payment Q3', '2026-11-10', null, { compliance: 'Income Tax', authority: 'IT' }),
];

const tasks: TaskInstance[] = [
  { id: 't1', engagementId: 'k', checklistKey: '', title: 'Draft the MOA object clause', status: 'in-progress', assigneeId: 'p-d', dueAt: '2026-10-21T11:44:45.283Z' },
  { id: 't2', engagementId: 'n', checklistKey: '', title: 'Chase DSC for the second director', status: 'not-started', assigneeId: 'p-a', dueAt: '2026-10-30T11:44:45.277Z' },
  { id: 't3', engagementId: 'q', checklistKey: '', title: 'Call the bank', status: 'completed', assigneeId: ME },
];

function input(extra: Partial<TodayInput> = {}): TodayInput {
  return {
    today: TODAY,
    meId: ME,
    scope: 'all',
    engagements: [kestrel, northwind, quarry, solstice],
    stateFor: (e) => states[e.id],
    tasks,
    requests: [],
    filings,
    approvals: [],
    leads: [
      { internId: 'lead-a', profileId: 'p-a', name: 'Arjun Mehta' },
      { internId: 'lead-d', profileId: 'p-d', name: 'Divya Nair' },
      { internId: 'lead-s', profileId: 'p-s', name: 'Sneha Kulkarni' },
    ],
    ...extra,
  };
}

describe('days', () => {
  it('weekOf gives Monday to Sunday', () => {
    expect(weekOf(TODAY)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
    expect(weekOf('2026-11-01')[0]).toBe('2026-10-26');
  });
  it('isoWeek numbers weeks', () => {
    expect(isoWeek('2026-10-29')).toBe(44);
    expect(isoWeek('2026-01-01')).toBe(1);
  });
});

describe('filings vocabulary', () => {
  it('derives on time / late / overdue / due this week / upcoming', () => {
    expect(filingSt({ dueDate: '2026-10-10', filedOn: '2026-10-10' }, TODAY)).toBe('f');
    expect(filingSt({ dueDate: '2026-10-10', filedOn: '2026-10-27' }, TODAY)).toBe('l');
    expect(filingSt({ dueDate: '2026-10-28', filedOn: null }, TODAY)).toBe('o');
    expect(filingSt({ dueDate: '2026-11-04', filedOn: null }, TODAY)).toBe('d');
    expect(filingSt({ dueDate: '2026-11-05', filedOn: null }, TODAY)).toBe('u');
  });
  it('names a filing once, with its period', () => {
    expect(filingName({ particular: 'Advance Tax Payment Q3', periodLabel: 'Advance Tax Payment Q3 2025' })).toBe('Advance Tax Payment Q3 2025');
    expect(filingName({ particular: 'Income Tax Return Filing', periodLabel: 'ITR FY 2025-26' })).toBe('Income Tax Return Filing FY 2025-26');
    expect(filingName({ particular: 'Form AOC-4', periodLabel: null })).toBe('Form AOC-4');
  });
});

describe('buildToday', () => {
  it('reads each client’s stage from the incorporation rule and counts the book', () => {
    const m = buildToday(input());
    expect(m.counts).toEqual({ all: 4, inc: 3, cmp: 1 });
    expect(m.byId.s!.stage).toBe('cmp');
    expect(m.byId.k!.stage).toBe('inc');
    expect(m.byId.s!.current).toBeUndefined();
  });

  it('finds who holds each current step and since when', () => {
    const m = buildToday(input());
    expect(m.byId.k!.current?.id).toBe('pre-7');
    expect(m.byId.k!.holder).toBe('you');
    expect(m.byId.n!.current?.id).toBe('pre-3');
    expect(m.byId.n!.holder).toBe('client');
    expect(m.byId.n!.since).toBe('2026-10-05');
    expect(m.byId.n!.heldDays).toBe(24);
    expect(m.byId.q!.since).toBe('2026-10-14');
  });

  it('builds one queue the tiles and Who holds the ball count from', () => {
    const m = buildToday(input());
    const ids = m.queue.map((q) => q.id);
    expect(ids).toContain('s:k:pre-7');
    expect(ids).toContain('s:n:pre-3');
    expect(ids).toContain('f:f1');
    expect(ids).toContain('f:f3');
    expect(ids).toContain('f:f8'); // 12 days out: upcoming
    expect(ids).not.toContain('f:f5'); // a month out
    expect(ids).not.toContain('f:f6'); // filed
    // overdue first, then due this week
    expect(m.queue[0]!.state).toBe('over');
    expect(m.kpi.act.length + m.kpi.wait.length).toBe(m.queue.length);
    expect(m.kpi.over.map((q) => q.id).sort()).toEqual(['f:f1', 'f:f2']);
    const nw = m.queue.find((q) => q.id === 's:n:pre-3')!;
    expect(nw).toMatchObject({ holder: 'client', state: 'wait', status: 'Client · 24d' });
    expect(nw.cta.to).toBe('mail');
    expect(nw.cta.href).toContain('/app/manager/mail?');
    const ks = m.queue.find((q) => q.id === 's:k:pre-7')!;
    expect(ks.cta).toEqual({ label: 'Open step', to: 'step', href: '/app/manager/projects/demo-k/step/kyc-review-and-dsc-creation' });
    expect(m.queue.find((q) => q.id === 'f:f3')!.status).toBe('Due Fri 30 Oct');
    expect(m.queue.find((q) => q.id === 'f:f1')!.status).toBe('29 days late');
  });

  it('puts an approval first for its client and does not repeat its step', () => {
    const approvals: PendingApprovalRow[] = [{ engagementId: 'n', companyName: northwind.companyName, itemId: 'pre-3', slug: 'demo-n', reviewSource: 'lead_manager_request' }];
    const m = buildToday(input({ approvals }));
    const forN = m.queue.filter((q) => q.clientId === 'n');
    expect(forN).toHaveLength(1);
    expect(forN[0]).toMatchObject({ source: 'approval', mine: true, holder: 'you', status: 'Needs you' });
    expect(forN[0]!.cta.label).toBe('Approve');
    expect(m.byId.n!.mine).toBe(true);
  });

  it('follows the Stage filter before counting', () => {
    const cmp = buildToday(input({ scope: 'cmp' }));
    expect(cmp.clients.map((c) => c.id)).toEqual(['s']);
    expect(cmp.queue.every((q) => q.clientId === 's')).toBe(true);
    expect(cmp.team.every((t) => t.clientId === 's')).toBe(true);
    const inc = buildToday(input({ scope: 'inc' }));
    expect(inc.filings).toHaveLength(0);
    expect(inc.queue.some((q) => q.source === 'filing')).toBe(false);
    expect(inc.counts).toEqual({ all: 4, inc: 3, cmp: 1 });
  });

  it('lists the leads’ work with the README statuses and attributes it', () => {
    const m = buildToday(input());
    const t1 = m.team.find((t) => t.taskId === 't1')!;
    expect(t1).toMatchObject({ st: 'over', dueLabel: 'Overdue 8d', leadKey: 'lead-d', leadName: 'Divya Nair' });
    const t2 = m.team.find((t) => t.taskId === 't2')!;
    expect(t2).toMatchObject({ st: 'due', dueLabel: 'Fri 30 Oct', leadName: 'Arjun Mehta' });
    expect(m.team.find((t) => t.taskId === 't3')).toMatchObject({ st: 'done', leadKey: '@me', leadName: 'You' });
    const nwStep = m.team.find((t) => t.id === 's:n:pre-3')!;
    expect(nwStep.st).toBe('wait');
    const solDone = m.team.filter((t) => t.clientId === 's' && t.st === 'done').map((t) => t.id);
    expect(solDone).toEqual(expect.arrayContaining(['d:s:reg-24', 'f:f7']));
    const divya = m.leads.find((l) => l.key === 'lead-d')!;
    expect(divya.clientIds.sort()).toEqual(['k', 's']);
    expect(divya.open.every((t) => t.st !== 'done')).toBe(true);
    expect(divya.overdue).toBe(divya.open.filter((t) => t.st === 'over').length);
  });

  it('lays out the week Monday to Sunday', () => {
    const m = buildToday(input());
    const lanes = m.week7.map((w) => `${w.lane}:${w.day}:${w.ref.filingId ?? w.ref.stepId ?? w.ref.taskId}`);
    expect(lanes).toEqual(
      expect.arrayContaining(['filing:2026-10-30:f3', 'filing:2026-10-31:f4', 'task:2026-10-30:t2', 'done:2026-10-27:f7', 'done:2026-10-27:reg-24']),
    );
    expect(m.kpi.weekOpen.map((w) => w.id).sort()).toEqual(['wf:f3', 'wf:f4', 'wt:t2']);
    expect(m.kpi.doneToday).toHaveLength(0);
  });

  it('derives health from late steps, overdue filings and the team’s flag', () => {
    const m = buildToday(input({ engagements: [kestrel, northwind, { ...quarry, health: 'at-risk' }, solstice] }));
    expect(m.byId.s!.health).toBe('stuck');
    expect(m.byId.s!.healthWhy).toBe('2 filings overdue');
    expect(m.byId.q!.health).toBe('risk');
    expect(m.byId.k!.health).toBe('ok');
    const fresh = buildToday(input({ stateFor: (e) => (e.id === 'q' ? {} : states[e.id]) }));
    expect(fresh.byId.q!.health).toBe('new');
  });

  it('counts the month and the practice areas from the same rows', () => {
    const m = buildToday(input());
    expect(m.monthRows.map((f) => f.id).sort()).toEqual(['f3', 'f4', 'f7']);
    expect(m.practice.monthCounts).toEqual({ f: 0, l: 1, o: 0, d: 2, u: 0 });
    // one overdue each: the earliest-due area wins the tie
    expect(m.practice.worstArea).toMatchObject({ area: 'IT', label: 'Income tax', n: 1 });
    expect(m.practice.pipeline.find((p) => p.key === 'name')!.clients.map((c) => c.id).sort()).toEqual(['n', 'q']);
    expect(m.practice.pipeline.find((p) => p.key === 'spice')!.clients.map((c) => c.id)).toEqual(['k']);
    expect(m.practice.regs).toMatchObject({ done: 23, run: 0, wait: 0 });
  });

  it('collects every dated item of a month for the mini calendar', () => {
    const m = buildToday(input());
    const oct = datedItems(m, '2026-10-01', '2026-10-31');
    expect(oct.map((w) => w.id).sort()).toEqual(['mf:f3', 'mf:f4', 'mf:f7', 'mt:t1', 'mt:t2']);
  });

  it('takes document requests as waiting on the client', () => {
    const requests: DocRequest[] = [{ id: 'r1', engagementId: 'q', taskId: 'x', label: 'Utility bill', status: 'pending', requestedBy: 'p-s' }];
    const m = buildToday(input({ requests }));
    expect(m.queue.find((q) => q.id === 'r:r1')).toMatchObject({ holder: 'client', state: 'wait', cta: { to: 'client', href: '/app/manager/projects/demo-q' } });
  });
});

describe('phaseSpan', () => {
  it('uses real dates only', () => {
    const m = buildToday(input());
    const k = m.byId.k!.model.phases;
    expect(phaseSpan(k[0]!, undefined, '2026-09-02', TODAY)).toEqual({ start: '2026-09-02', end: '2026-09-22', kind: 'actual', open: false });
    expect(phaseSpan(k[1]!, '2026-09-22', '2026-09-02', TODAY)).toEqual({ start: '2026-09-22', end: TODAY, kind: 'actual', open: true });
    expect(phaseSpan(k[2]!, undefined, '2026-09-02', TODAY)).toBeUndefined();
  });
});

describe('lead seat', () => {
  it('links under the seat base and hands approvals to the manager', async () => {
    const { buildDesk } = await import('../lead/desk');
    const approvals: PendingApprovalRow[] = [{ engagementId: 'n', companyName: northwind.companyName, itemId: 'pre-3', slug: 'demo-n', reviewSource: 'lead_manager_request' }];
    const m = buildToday(input({ approvals, base: '/app/intern', seat: 'lead', meId: 'p-d' }));
    const a = m.queue.find((q) => q.source === 'approval')!;
    expect(a).toMatchObject({ holder: 'mgr', state: 'wait', mine: false, cta: { label: 'Email manager again', to: 'nudge' } });
    expect(m.byId.k!.href).toBe('/app/intern/projects/demo-k');
    expect(m.queue.find((q) => q.id === 's:k:pre-7')!.cta.href).toBe('/app/intern/projects/demo-k/step/kyc-review-and-dsc-creation');
    expect(m.queue.find((q) => q.source === 'filing')!.cta.href).toBe('/app/intern/compliances/filings');
    const desk = buildDesk(m);
    // the lead's own task (assigned to p-d) joins the desk; others' tasks do not
    expect(desk.items.some((i) => i.taskId === 't1')).toBe(true);
    expect(desk.items.some((i) => i.taskId === 't2')).toBe(false);
    expect(desk.waiting.some((i) => i.holder === 'mgr')).toBe(true);
    expect(desk.today.every((i) => i.holder === 'you' && (!i.due || i.due <= TODAY))).toBe(true);
    expect(desk.kpi.overdue).toBe(desk.items.filter((i) => !i.done && i.state === 'over').length);
  });

  it('reviews only document uploads and files on open steps', async () => {
    const { buildReviews } = await import('../lead/desk');
    const m = buildToday(input({ seat: 'lead', base: '/app/intern' }));
    const out = buildReviews(
      m,
      [
        { id: 'r1', engagementId: 'q', label: 'Utility bill', status: 'uploaded' },
        { id: 'r2', engagementId: 'q', label: 'PAN', status: 'pending' },
      ],
      {
        k: [
          { id: 'f1', stepId: 'pre-7', label: 'Passport', fulfilledAt: '2026-10-20T05:00:00Z' },
          { id: 'f2', stepId: 'pre-1', label: 'Old file', fulfilledAt: '2026-09-01T05:00:00Z' },
          { id: 'f3', stepId: 'pre-7', label: 'Not yet' },
        ],
      },
    );
    expect(out.map((r) => r.id).sort()).toEqual(['f:f1', 'u:r1']);
  });
});
