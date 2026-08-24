import { describe, expect, it } from 'vitest';
import type { Engagement } from '@/data/engagements';
import {
  buildInternWorkItems,
  createCustomInternFocus,
  internGreeting,
  internPaceLine,
  internQueueCompanyHref,
  internTimelineGrid,
  internTimelineRows,
  internWeekAnchorYmd,
  internWeekChipKind,
  internWeekChipsForDay,
  internWeekDayCounts,
  internWorkItemsForDay,
  istWeekYmds,
  ymdFromIsoInIst,
  internWorkBoard,
  internWorkKpis,
  internWorkMatches,
  internWorkPath,
  internWorkStepTitle,
  isCustomInternFocus,
  parseInternFocus,
  parseInternQueueExpanded,
  serializeInternFocus,
  serializeInternQueueExpanded,
  ymdInIst,
  type InternWorkItem,
} from '@/lib/intern-work';
import { getItem } from '@/data/checklist';

const engagement: Engagement = {
  id: 'eng-1',
  clientId: 'c1',
  companyName: 'ABC India',
  companyType: 'domestic',
  internId: 'intern-a',
  adminId: 'admin',
  createdAt: '2026-08-01T00:00:00.000Z',
  stage: 'Pre-Incorporation',
  health: 'on-track',
};

const now = new Date('2026-08-20T09:00:00+05:30');

describe('internGreeting / pace', () => {
  it('splits the IST day into morning afternoon evening', () => {
    expect(internGreeting(8)).toBe('morning');
    expect(internGreeting(14)).toBe('afternoon');
    expect(internGreeting(19)).toBe('evening');
  });

  it('writes a short pace line from done vs remaining', () => {
    expect(internPaceLine(0, 7)).toMatch(/reddest/i);
    expect(internPaceLine(2, 5)).toMatch(/pace/i);
    expect(internPaceLine(0, 0)).toMatch(/clear/i);
  });
});

describe('buildInternWorkItems', () => {
  it('puts rejected, client-review, and deliver into the action KPI', () => {
    const rejectedEng = { ...engagement, id: 'eng-rej', companyName: 'Rejected Co' };
    const deliverEng = { ...engagement, id: 'eng-del', companyName: 'Deliver Co' };
    const items = buildInternWorkItems({
      engagements: [engagement, rejectedEng, deliverEng],
      internId: 'intern-a',
      now,
      getChecklistState: (e) => {
        if (e.id === 'eng-rej') {
          return { 'pre-1': { status: 'in-progress', reviewStatus: 'rejected' } };
        }
        if (e.id === 'eng-del') {
          return { 'pre-1': { status: 'in-progress', reviewStatus: 'accepted' } };
        }
        return {
          'pre-1': {
            status: 'in-progress',
            reviewStatus: 'reviewing',
            reviewSource: 'client_submission',
            clientSubmittedAt: '2026-08-19T10:00:00.000Z',
          },
        };
      },
    });
    const kpis = internWorkKpis(items, now);
    expect(kpis.action.rejected).toBeGreaterThanOrEqual(1);
    expect(kpis.action.review).toBeGreaterThanOrEqual(1);
    expect(kpis.action.deliver).toBeGreaterThanOrEqual(1);
    expect(items.find((i) => i.engagementId === 'eng-rej' && i.catalogId === 'pre-1')?.kind).toBe(
      'rejected',
    );
    expect(items.find((i) => i.engagementId === 'eng-1' && i.catalogId === 'pre-1')?.kind).toBe(
      'review',
    );
    expect(items.find((i) => i.engagementId === 'eng-del' && i.catalogId === 'pre-1')?.kind).toBe(
      'deliver',
    );
  });

  it('counts manager-approval review as waiting, not action', () => {
    const items = buildInternWorkItems({
      engagements: [engagement],
      internId: 'intern-a',
      now,
      getChecklistState: () => ({
        'pre-1': {
          status: 'in-progress',
          reviewStatus: 'reviewing',
          reviewSource: 'lead_manager_request',
          clientSubmittedAt: '2026-08-18T10:00:00.000Z',
        },
      }),
    });
    const kpis = internWorkKpis(items, now);
    expect(kpis.waiting.manager).toBeGreaterThanOrEqual(1);
    expect(items.find((i) => i.catalogId === 'pre-1')?.kind).toBe('waiting-manager');
    expect(internWorkMatches(items.find((i) => i.catalogId === 'pre-1')!, { focus: 'waiting' }, now)).toBe(
      true,
    );
  });

  it('keeps overdue current-gate steps in the overdue KPI', () => {
    const items = buildInternWorkItems({
      engagements: [engagement],
      internId: 'intern-a',
      now,
      getChecklistState: () => ({
        'pre-1': { status: 'overdue' },
      }),
    });
    const kpis = internWorkKpis(items, now);
    expect(kpis.overdue.total).toBeGreaterThanOrEqual(1);
    expect(items.find((i) => i.catalogId === 'pre-1')?.kind).toBe('overdue');
  });

  it('places filings due this week on the due KPI and board', () => {
    const items = buildInternWorkItems({
      engagements: [engagement],
      internId: 'intern-a',
      now,
      getChecklistState: () => ({}),
      filings: [
        {
          id: 'cf-gstr',
          engagementId: 'eng-1',
          filing: 'GSTR-1',
          authority: 'GST',
          frequency: 'monthly',
          nextDue: '2026-08-20',
          ownerId: 'intern-a',
          status: 'upcoming',
          penaltyRisk: 'medium',
        },
      ],
    });
    const kpis = internWorkKpis(items, now);
    expect(kpis.dueWeek.filings).toBe(1);
    const filing = items.find((i) => i.filingId === 'cf-gstr');
    expect(filing?.kind).toBe('filing');
    expect(internWorkBoard(items, now).action.some((i) => i.filingId === 'cf-gstr')).toBe(true);
  });

  it('includes pending document requests as waiting on the client', () => {
    const items = buildInternWorkItems({
      engagements: [engagement],
      internId: 'intern-a',
      now,
      getChecklistState: () => ({}),
      requests: [
        {
          id: 'req-1',
          engagementId: 'eng-1',
          taskId: 't1',
          label: 'Bank letter',
          status: 'pending',
          requestedBy: 'intern-a',
        },
      ],
    });
    expect(items.find((i) => i.requestId === 'req-1')?.kind).toBe('waiting-request');
    expect(items.find((i) => i.requestId === 'req-1')?.href).toBe('/app/intern/engagements/eng-1');
    expect(internWorkKpis(items, now).waiting.client).toBeGreaterThanOrEqual(1);
  });

  it('scopes to the signed-in intern', () => {
    const other = { ...engagement, id: 'eng-2', internId: 'intern-b' };
    const items = buildInternWorkItems({
      engagements: [engagement, other],
      internId: 'intern-a',
      now,
      getChecklistState: () => ({ 'pre-1': { status: 'overdue' } }),
    });
    expect(items.every((i) => i.engagementId === 'eng-1')).toBe(true);
  });

  it('includes co-lead projects from leadIds', () => {
    const shared = { ...engagement, internId: 'intern-b', leadIds: ['intern-b', 'intern-a'] };
    const items = buildInternWorkItems({
      engagements: [shared],
      internId: 'intern-a',
      now,
      getChecklistState: () => ({ 'pre-1': { status: 'overdue' } }),
    });
    expect(items.some((i) => i.engagementId === 'eng-1' && i.catalogId === 'pre-1')).toBe(true);
  });

  it('keeps steps completed this IST week and drops last week', () => {
    const items = buildInternWorkItems({
      engagements: [engagement],
      internId: 'intern-a',
      now,
      getChecklistState: () => ({
        'pre-1': { status: 'completed', completedOn: '2026-08-18' },
        'pre-2': { status: 'completed', completedOn: '2026-08-10' },
      }),
    });
    const thisWeek = items.find((i) => i.catalogId === 'pre-1');
    expect(thisWeek?.kind).toBe('done');
    expect(items.find((i) => i.catalogId === 'pre-2')).toBeUndefined();
    expect(internWorkMatches(thisWeek!, { focus: 'due' }, now)).toBe(true);
    expect(internWorkKpis(items, now).dueWeek.total).toBe(0);
  });

  it('lists filings filed this week under due focus without inflating remaining due', () => {
    const items = buildInternWorkItems({
      engagements: [engagement],
      internId: 'intern-a',
      now,
      getChecklistState: () => ({}),
      filings: [
        {
          id: 'cf-filed',
          engagementId: 'eng-1',
          filing: 'GSTR-1',
          authority: 'GST',
          frequency: 'monthly',
          nextDue: '2026-08-19',
          ownerId: 'intern-a',
          status: 'filed',
          penaltyRisk: 'medium',
        },
        {
          id: 'cf-old',
          engagementId: 'eng-1',
          filing: 'GSTR-3B',
          authority: 'GST',
          frequency: 'monthly',
          nextDue: '2026-08-10',
          ownerId: 'intern-a',
          status: 'filed',
          penaltyRisk: 'low',
        },
      ],
    });
    const filed = items.find((i) => i.filingId === 'cf-filed');
    expect(filed?.kind).toBe('done');
    expect(items.find((i) => i.filingId === 'cf-old')).toBeUndefined();
    expect(internWorkMatches(filed!, { focus: 'due' }, now)).toBe(true);
    expect(internWorkKpis(items, now).dueWeek.filings).toBe(0);
  });
});

function weekItem(overrides: Partial<InternWorkItem> & Pick<InternWorkItem, 'id'>): InternWorkItem {
  return {
    source: 'step',
    engagementId: 'eng-1',
    companyName: 'ABC India',
    title: 'Pre-1 · Name reservation',
    kind: 'in-progress',
    href: '/step',
    why: 'In progress',
    isOverdue: false,
    isCritical: false,
    catalogLabel: 'Pre-1',
    ...overrides,
  };
}

describe('this-week done visibility', () => {
  const today = '2026-08-20';

  it('places a done chip on the IST completion day, not other weekdays', () => {
    const done = weekItem({
      id: 'step:eng-1:pre-1',
      kind: 'done',
      completedAt: '2026-08-18',
      dueAt: '2026-08-20',
    });
    expect(internWeekChipKind(done, '2026-08-18', today)).toBe('done');
    expect(internWeekChipKind(done, '2026-08-20', today)).toBeNull();
    expect(internWeekChipKind(done, '2026-08-17', today)).toBeNull();
  });

  it('keeps a done chip when open due items would fill the day limit', () => {
    const chips = internWeekChipsForDay(
      [
        weekItem({
          id: 'filing:a',
          source: 'filing',
          kind: 'filing',
          title: 'GSTR-1',
          dueAt: today,
        }),
        weekItem({
          id: 'filing:b',
          source: 'filing',
          kind: 'filing',
          title: 'GSTR-3B',
          dueAt: today,
        }),
        weekItem({
          id: 'step:done',
          kind: 'done',
          completedAt: today,
          catalogLabel: 'Pre-1',
        }),
      ],
      today,
      today,
      2,
    );
    expect(chips.some((c) => c.kind === 'done')).toBe(true);
    expect(chips.some((c) => c.kind === 'filing')).toBe(true);
    expect(chips).toHaveLength(2);
  });

  it('does not match last-week completions in the due focus', () => {
    const old = weekItem({
      id: 'step:old',
      kind: 'done',
      completedAt: '2026-08-10',
      dueAt: '2026-08-10',
    });
    expect(internWorkMatches(old, { focus: 'due' }, now)).toBe(false);
    expect(internWorkMatches(old, { focus: 'done' }, now)).toBe(true);
  });

  it('marks done-this-week on the timeline at the completion day', () => {
    const rows = internTimelineRows(
      [
        weekItem({
          id: 'step:done',
          kind: 'done',
          completedAt: '2026-08-18',
        }),
      ],
      now,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ ymd: '2026-08-18', kind: 'done' });
  });
});

describe('IST date mapping', () => {
  it('keeps YYYY-MM-DD on the civil day and maps IST midnight from UTC', () => {
    expect(ymdFromIsoInIst('2026-08-25')).toBe('2026-08-25');
    expect(ymdFromIsoInIst('2026-08-24T18:30:00.000Z')).toBe('2026-08-25');
    expect(ymdFromIsoInIst('2026-08-20T09:00:00+05:30')).toBe('2026-08-20');
  });

  it('builds a Monday–Sunday IST week that includes today', () => {
    const week = istWeekYmds(now, 7);
    expect(week).toHaveLength(7);
    expect(week[0]).toBe('2026-08-17');
    expect(week[6]).toBe('2026-08-23');
    expect(week).toContain('2026-08-20');
  });

  it('places overdue filings and undated nudges on today, not empty cells', () => {
    const today = '2026-08-20';
    const overdueFiling = weekItem({
      id: 'filing:old',
      source: 'filing',
      kind: 'filing',
      title: 'GSTR-1',
      dueAt: '2026-08-11',
      isOverdue: true,
    });
    const nudge = weekItem({
      id: 'step:nudge',
      kind: 'waiting-manager',
      title: 'Pre-1 · Name reservation',
    });
    const thursday = weekItem({
      id: 'filing:thu',
      source: 'filing',
      kind: 'filing',
      title: 'GSTR-3B',
      dueAt: '2026-08-21',
    });
    expect(internWeekChipKind(overdueFiling, today, today)).toBe('filing');
    expect(internWeekChipKind(overdueFiling, '2026-08-21', today)).toBeNull();
    expect(internWeekChipKind(nudge, today, today)).toBe('nudge');
    expect(internWeekChipKind(nudge, '2026-08-21', today)).toBeNull();
    expect(internWeekChipKind(thursday, '2026-08-21', today)).toBe('filing');
    expect(internWeekChipKind(thursday, today, today)).toBeNull();
    expect(internWeekDayCounts([overdueFiling, nudge, thursday], today, today)).toEqual({
      filing: 1,
      step: 0,
      nudge: 1,
      done: 0,
    });
    expect(internWorkItemsForDay([overdueFiling, nudge, thursday], '2026-08-21', today).map((i) => i.id)).toEqual([
      'filing:thu',
    ]);
  });

  it('anchors waiting-client steps on their IST due day this week', () => {
    const item = weekItem({
      id: 'step:wait',
      kind: 'waiting-client',
      dueAt: '2026-08-22',
    });
    expect(internWeekAnchorYmd(item, '2026-08-20', istWeekYmds(now, 7))).toBe('2026-08-22');
    expect(internWeekChipKind(item, '2026-08-22', '2026-08-20')).toBe('nudge');
  });
});

describe('intern timeline grid', () => {
  it('puts cards in the due-day column instead of spanning a gantt bar', () => {
    const grid = internTimelineGrid(
      [
        weekItem({
          id: 'filing:a',
          source: 'filing',
          kind: 'filing',
          title: 'GSTR-1',
          dueAt: '2026-08-21',
        }),
        weekItem({
          id: 'step:open',
          kind: 'in-progress',
        }),
      ],
      now,
    );
    const friday = grid.days.find((col) => col.ymd === '2026-08-21');
    const todayCol = grid.days.find((col) => col.ymd === '2026-08-20');
    expect(friday?.items.map((i) => i.id)).toEqual(['filing:a']);
    expect(todayCol?.items.map((i) => i.id)).toEqual(['step:open']);
    expect(grid.days).toHaveLength(14);
  });
});

describe('internWorkPath', () => {
  it('encodes cockpit filters onto /app/intern/tasks', () => {
    expect(internWorkPath({ focus: 'action', tag: 'rejected' })).toBe(
      '/app/intern/tasks?focus=action&tag=rejected',
    );
    expect(internWorkPath({ day: '2026-08-25', view: 'tl' })).toBe('/app/intern/tasks?day=2026-08-25');
  });
});

describe('internWorkStepTitle', () => {
  it('prefixes pre-inc catalog ids', () => {
    const item = getItem('pre-1');
    expect(item).toBeTruthy();
    expect(internWorkStepTitle(item!)).toMatch(/^Pre-1 · /);
  });
});

describe('internQueueCompanyHref', () => {
  it('uses the intern engagement path from a step href', () => {
    expect(
      internQueueCompanyHref('eng-1', [
        weekItem({ id: 'x', href: '/app/intern/engagements/abc-india/step/client-details' }),
      ]),
    ).toBe('/app/intern/engagements/abc-india');
  });

  it('falls back to /app/intern/engagements/{id}', () => {
    expect(internQueueCompanyHref('eng-1', [weekItem({ id: 'x', href: '/app/intern/compliance' })])).toBe(
      '/app/intern/engagements/eng-1',
    );
  });
});

describe('ymdInIst', () => {
  it('formats the fixture instant as 20 Aug 2026 in IST', () => {
    expect(ymdInIst(now)).toBe('2026-08-20');
  });
});

describe('intern focus todos', () => {
  it('parses legacy string ids and { id, done } pins', () => {
    expect(parseInternFocus(['step:eng-1:pre-1', { id: 'filing:cf-1', done: true }])).toEqual([
      { id: 'step:eng-1:pre-1', done: false },
      { id: 'filing:cf-1', done: true },
    ]);
  });

  it('parses custom todos with title and treats custom: ids as custom', () => {
    const parsed = parseInternFocus([
      { id: 'custom:abc', done: false, custom: true, title: 'Call registrar' },
      { id: 'custom:def', done: true, title: 'Send nudge' },
    ]);
    expect(parsed[0]).toEqual({ id: 'custom:abc', done: false, custom: true, title: 'Call registrar' });
    expect(parsed[1]).toEqual({ id: 'custom:def', done: true, custom: true, title: 'Send nudge' });
    expect(parsed.every(isCustomInternFocus)).toBe(true);
  });

  it('serializes more than three mixed pins without capping', () => {
    const custom = createCustomInternFocus('Bank visit');
    expect(custom.custom).toBe(true);
    expect(custom.title).toBe('Bank visit');
    expect(isCustomInternFocus(custom)).toBe(true);

    const stored = serializeInternFocus([
      { id: 'step:a', done: false },
      { id: 'step:b', done: true },
      { id: 'step:c', done: false },
      { id: 'step:d', done: false },
      custom,
    ]);
    expect(stored).toHaveLength(5);
    expect(stored.slice(0, 4)).toEqual([
      { id: 'step:a', done: false },
      { id: 'step:b', done: true },
      { id: 'step:c', done: false },
      { id: 'step:d', done: false },
    ]);
    expect(stored[4]).toEqual({
      id: custom.id,
      done: false,
      custom: true,
      title: 'Bank visit',
    });
  });

  it('ignores garbage rows', () => {
    expect(parseInternFocus(null)).toEqual([]);
    expect(parseInternFocus([{ done: true }, 12, { id: '' }])).toEqual([]);
  });
});

describe('intern queue expanded ids', () => {
  it('parses unique trimmed engagement ids', () => {
    expect(parseInternQueueExpanded(['eng-1', ' eng-2 ', 'eng-1', 12, ''])).toEqual(['eng-1', 'eng-2']);
  });

  it('ignores non-arrays and serializes a set without duplicates', () => {
    expect(parseInternQueueExpanded(null)).toEqual([]);
    expect(parseInternQueueExpanded({ ids: ['x'] })).toEqual([]);
    expect(serializeInternQueueExpanded(new Set(['b', 'a', 'b']))).toEqual(['b', 'a']);
  });
});
