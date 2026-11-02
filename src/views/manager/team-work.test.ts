import { describe, expect, it } from 'vitest';
import type { Engagement, TaskInstance } from '@/data/engagements';
import type { InternWorkItem } from '@/lib/intern/intern-work';
import { areaSplit, buildTeamWork, statusCounts, workTimeline } from '@/views/manager/team-work';

const now = new Date('2026-08-20T09:00:00+05:30');

function eng(over: Partial<Engagement>): Engagement {
  return {
    id: 'eng-1',
    slug: 'abc-india',
    clientId: 'c1',
    companyName: 'ABC India',
    companyType: 'domestic',
    internId: 'intern-a',
    leadIds: ['intern-a'],
    adminId: 'admin',
    managerId: 'mgr-1',
    createdAt: '2026-08-01T00:00:00.000Z',
    stage: 'Pre-Incorporation',
    health: 'on-track',
    ...over,
  };
}

function task(over: Partial<TaskInstance>): TaskInstance {
  return { id: 't1', engagementId: 'eng-1', checklistKey: '', status: 'not-started', title: 'Call the bank', ...over };
}

const leads = [
  { id: 'intern-a', name: 'Asha Rao', profileId: 'p-a' },
  { id: 'intern-b', name: 'Bala N', profileId: 'p-b' },
];

function build(engagements: Engagement[], tasks: TaskInstance[] = [], extraLeads = leads) {
  return buildTeamWork({
    engagements,
    getState: () => ({}),
    filings: [],
    requests: [],
    tasks,
    leads: extraLeads,
    projectBase: '/app/manager',
    now,
  });
}

describe('buildTeamWork', () => {
  it('gives each step to the primary lead and links it to the staff project page', () => {
    const items = build([eng({})]);
    expect(items.length).toBeGreaterThan(0);
    for (const i of items) {
      expect(i.leadId).toBe('intern-a');
      expect(i.leadName).toBe('Asha Rao');
      expect(i.href.startsWith('/app/manager/')).toBe(true);
      expect(i.row).toMatchObject({ leadId: 'intern-a', itemId: i.id, engagementId: 'eng-1' });
    }
  });

  it('gives a task to the lead it is assigned to, by profile id', () => {
    const items = build([eng({ internId: '' })], [task({ assigneeId: 'p-b', dueAt: '2026-08-25T12:00:00Z' })]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 'task:t1', leadId: 'intern-b', leadName: 'Bala N', area: 'Tasks', source: 'task' });
  });

  it('keeps a staff owner’s own tasks under their profile key', () => {
    const items = build(
      [eng({ internId: '' })],
      [task({ assigneeId: 'mgr-1' })],
      [...leads, { id: 'profile:mgr-1', name: 'Priya', profileId: 'mgr-1' }],
    );
    expect(items[0]).toMatchObject({ leadId: 'profile:mgr-1', leadName: 'Priya' });
  });

  it('skips companies in operational readiness and tasks nobody on the team holds', () => {
    expect(build([eng({ stage: 'Operational Readiness' })])).toEqual([]);
    expect(build([eng({ internId: '' })], [task({ assigneeId: 'someone-else' })])).toEqual([]);
  });
});

describe('statusCounts and areaSplit', () => {
  const rows = [
    { status: 'Done' as const, area: 'ROC' },
    { status: 'Overdue' as const, area: 'ROC' },
    { status: 'In progress' as const, area: 'ROC' },
    { status: 'Waiting' as const, area: 'Tasks' },
  ];

  it('counts every status word in chart order', () => {
    const counts = statusCounts(rows);
    expect(counts.map((c) => c.status)).toEqual(['Overdue', 'Due soon', 'In progress', 'Waiting', 'Not started', 'Done']);
    expect(counts.find((c) => c.status === 'Overdue')?.n).toBe(1);
    expect(counts.reduce((a, c) => a + c.n, 0)).toBe(4);
  });

  it('splits each area into done, pending and late', () => {
    expect(areaSplit(rows)).toEqual([
      { area: 'ROC', done: 1, pending: 1, late: 1, total: 3 },
      { area: 'Tasks', done: 0, pending: 1, late: 0, total: 1 },
    ]);
  });
});

describe('workTimeline', () => {
  const item = (over: Partial<InternWorkItem>): InternWorkItem => ({
    id: 'step:x',
    source: 'step',
    engagementId: 'eng-1',
    companyName: 'ABC India',
    title: 'Name approval',
    kind: 'in-progress',
    href: '/x',
    why: 'In progress',
    isOverdue: false,
    isCritical: false,
    ...over,
  });

  it('is null when nothing open has a due date', () => {
    expect(workTimeline([item({}), item({ id: 'b', kind: 'done', dueAt: '2026-08-22' })], '2026-08-20')).toBeNull();
  });

  it('draws a late item as one red bar and an open one solid to today, hatch after', () => {
    const tl = workTimeline(
      [
        item({ id: 'late', dueAt: '2026-08-18T12:00:00+05:30', isOverdue: true }),
        item({ id: 'open', dueAt: '2026-08-22T12:00:00+05:30' }),
        item({ id: 'later', dueAt: '2026-09-10T12:00:00+05:30' }),
      ],
      '2026-08-20',
    )!;
    expect(tl.rows.map((r) => r.id)).toEqual(['late', 'open', 'later']);
    expect(tl.rows[0]!.bars).toEqual([{ from: '2026-08-14', to: '2026-08-18', kind: 'late' }]);
    expect(tl.rows[1]!.bars.map((b) => b.kind)).toEqual(['cur', 'rest']);
    expect(tl.rows[2]!.bars).toEqual([{ from: '2026-09-06', to: '2026-09-10', kind: 'plan' }]);
    expect(tl.start! <= '2026-08-14').toBe(true);
    expect(tl.end! >= '2026-09-10').toBe(true);
    expect(tl.ticks).toHaveLength(4);
  });
});
