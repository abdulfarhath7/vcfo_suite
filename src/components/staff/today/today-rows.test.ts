import { describe, expect, it } from 'vitest';
import type { Engagement } from '@/data/engagements';
import type { InternWorkItem } from '@/lib/intern/intern-work';
import {
  buildPhaseProgressRows,
  buildTeamTaskRows,
  countByStatus,
  dayMonth,
  daysFromToday,
  engagementInScope,
  todayStatusOf,
} from '@/components/staff/today/today-rows';

const now = new Date('2026-08-20T09:00:00+05:30');

const engagement: Engagement = {
  id: 'eng-1',
  slug: 'abc-india',
  clientId: 'c1',
  companyName: 'ABC India',
  companyType: 'domestic',
  internId: 'intern-a',
  adminId: 'admin',
  managerId: 'mgr-1',
  createdAt: '2026-08-01T00:00:00.000Z',
  stage: 'Pre-Incorporation',
  health: 'on-track',
};

function item(over: Partial<InternWorkItem>): InternWorkItem {
  return {
    id: 'step:eng-1:pre-2',
    source: 'step',
    engagementId: 'eng-1',
    companyName: 'ABC India',
    title: 'Step',
    kind: 'in-progress',
    href: '/x',
    why: '',
    isOverdue: false,
    isCritical: false,
    catalogId: 'pre-2',
    ...over,
  };
}

describe('todayStatusOf', () => {
  it('maps work items to the six status words', () => {
    expect(todayStatusOf(item({ kind: 'done' }), undefined, now)).toBe('Done');
    expect(todayStatusOf(item({ isOverdue: true }), { status: 'in-progress' }, now)).toBe('Overdue');
    expect(todayStatusOf(item({ kind: 'waiting-client' }), undefined, now)).toBe('Waiting');
    expect(todayStatusOf(item({ dueAt: '2026-08-24' }), { status: 'in-progress' }, now)).toBe('Due soon');
    expect(todayStatusOf(item({}), { status: 'not-started' }, now)).toBe('Not started');
    expect(todayStatusOf(item({ dueAt: '2026-09-30' }), { status: 'in-progress' }, now)).toBe('In progress');
  });

  it('counts rows per status in chart order', () => {
    const counts = countByStatus([{ status: 'Done' }, { status: 'Done' }, { status: 'Overdue' }]);
    expect(counts.Done).toBe(2);
    expect(counts.Overdue).toBe(1);
    expect(counts.Waiting).toBe(0);
  });
});

describe('dates', () => {
  it('writes plain day and month and counts days from today in IST', () => {
    expect(dayMonth('2026-09-14')).toBe('14 Sep');
    expect(dayMonth(undefined)).toBe('');
    expect(daysFromToday('2026-08-25', now)).toBe(5);
    expect(daysFromToday('2026-08-18', now)).toBe(-2);
    expect(daysFromToday(undefined, now)).toBeNull();
  });
});

describe('scope', () => {
  it('splits incorporating from incorporated projects', () => {
    const post: Engagement = { ...engagement, id: 'eng-2', stage: 'Post-Incorporation' };
    expect(engagementInScope('incorporating', engagement, {})).toBe(true);
    expect(engagementInScope('compliance', engagement, {})).toBe(false);
    expect(engagementInScope('compliance', post, {})).toBe(true);
    expect(engagementInScope('all', post, {})).toBe(true);
  });
});

describe('buildTeamTaskRows', () => {
  it('lists each lead’s work with staff links and the lead name', () => {
    const rows = buildTeamTaskRows({
      engagements: [engagement],
      getState: () => ({}),
      filings: [],
      requests: [],
      leads: [{ id: 'intern-a', name: 'Asha Rao' }],
      projectBase: '/app/manager',
      now,
    });
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.leadName).toBe('Asha Rao');
      expect(r.href.startsWith('/app/manager/')).toBe(true);
      expect(r.companyName).toBe('ABC India');
    }
  });

  it('skips projects without a lead', () => {
    const rows = buildTeamTaskRows({
      engagements: [{ ...engagement, internId: '' }],
      getState: () => ({}),
      filings: [],
      requests: [],
      leads: [],
      projectBase: '/app/manager',
      now,
    });
    expect(rows).toEqual([]);
  });
});

describe('buildPhaseProgressRows', () => {
  it('gives four phases with step counts and the days to the incorporation date', () => {
    const rows = buildPhaseProgressRows({
      engagements: [{ ...engagement, schedule: { incorporation: { from: '2026-08-01', to: '2026-08-30', setBy: 'mgr-1', setAt: '2026-08-01T00:00:00.000Z' } } }],
      getState: () => ({}),
      now,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].totals.length).toBe(rows[0].done.length);
    expect(rows[0].stepsTotal).toBeGreaterThan(0);
    expect(rows[0].daysToCoi).toBe(10);
    expect(rows[0].incorporated).toBe(false);
  });
});
