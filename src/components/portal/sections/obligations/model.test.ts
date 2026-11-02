import { describe, expect, it } from 'vitest';
import type { PortalFiling } from '@/lib/client-portal/compliances';
import { groupObligations } from '@/components/client-portal/pages/compliances/obligations';
import type { ClientTask } from '@/components/client-portal/pages/compliances/tasks';
import { cardPeriods, dueWords, firstName, isNotFound, overdueCount, statSummary, taskSummary, whenText } from './model';

const TODAY = '2026-10-28';

const filing = (p: Partial<PortalFiling> & Pick<PortalFiling, 'id' | 'dueDate'>): PortalFiling => ({
  engagementId: 'e1',
  companyName: 'Co',
  particular: 'GSTR-3B Filing',
  name: 'GSTR-3B',
  area: 'GST',
  authority: 'GST',
  authorityName: 'GSTN',
  frequency: 'monthly',
  freqLabel: 'Monthly',
  filedOn: null,
  period: 'Sep 2026',
  periodLong: null,
  fyLabel: 'FY 2026-27',
  rawStatus: 'pending',
  windowFrom: null,
  windowTo: null,
  penaltyRisk: 'high',
  ownerName: null,
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
});

const task = (p: Partial<ClientTask> & Pick<ClientTask, 'id' | 'endDate'>): ClientTask => ({
  name: 'Board pack',
  activityName: null,
  startDate: '2026-10-01',
  urgency: 'high',
  visibility: 'both',
  stage: 'not_started',
  completedOn: null,
  ownerName: 'Priya Raman',
  notifyDays: 5,
  deliverable: null,
  ...p,
});

describe('due words', () => {
  it('reads the end date against today', () => {
    expect(dueWords('2026-11-01', TODAY, false)).toBe('Due in 4 days');
    expect(dueWords('2026-10-29', TODAY, false)).toBe('Due in 1 day');
    expect(dueWords(TODAY, TODAY, false)).toBe('Due today');
    expect(dueWords('2026-10-25', TODAY, false)).toBe('3 days overdue');
    expect(dueWords('2026-10-27', TODAY, false)).toBe('1 day overdue');
    expect(dueWords('2026-10-01', TODAY, true)).toBe('Done');
  });
});

describe('when text', () => {
  it('shows a day for dates and timestamps, a dash for nothing', () => {
    expect(whenText('2026-10-14')).toBe('14 Oct');
    expect(whenText('2026-10-14T09:30:00.000Z')).toBe('14 Oct');
    expect(whenText(null)).toBe('—');
    expect(whenText('')).toBe('—');
  });
});

describe('counts', () => {
  const rows = [filing({ id: 'a', dueDate: '2026-10-20' }), filing({ id: 'b', dueDate: '2026-11-20' }), filing({ id: 'c', dueDate: '2026-09-20', filedOn: '2026-09-18' })];
  const tasks = [task({ id: 't1', endDate: '2026-10-20' }), task({ id: 't2', endDate: '2026-10-30' }), task({ id: 't3', endDate: '2026-10-01', stage: 'completed', completedOn: '2026-09-30' })];

  it('counts overdue filings and overdue tasks for the badge', () => {
    expect(overdueCount(rows, tasks, TODAY)).toBe(2);
    expect(overdueCount([], [], TODAY)).toBe(0);
  });

  it('summarises tasks in the six words, in order, skipping empty ones', () => {
    expect(taskSummary(tasks, TODAY)).toBe('1 overdue · 1 due soon · 1 done');
    expect(taskSummary([], TODAY)).toBe('');
  });

  it('summarises obligations by their worst open state', () => {
    const obligations = groupObligations(
      [...rows, filing({ id: 'd', dueDate: '2026-12-01', particular: 'PF ECR', name: 'PF ECR', area: 'PAY', authority: 'EPFO' })],
      TODAY,
    );
    expect(statSummary(obligations)).toBe('1 overdue · 1 upcoming');
  });
});

describe('card periods', () => {
  it('lists open periods soonest first, then filed ones newest first', () => {
    const o = groupObligations(
      [
        filing({ id: 'nov', dueDate: '2026-11-20' }),
        filing({ id: 'oct', dueDate: '2026-10-20' }),
        filing({ id: 'aug', dueDate: '2026-08-20', filedOn: '2026-08-19' }),
        filing({ id: 'sep', dueDate: '2026-09-20', filedOn: '2026-09-18' }),
      ],
      TODAY,
    )[0]!;
    expect(cardPeriods(o).map((f) => f.id)).toEqual(['oct', 'nov', 'sep', 'aug']);
  });
});

describe('small helpers', () => {
  it('recognises the 404 of a task that is not shared', () => {
    expect(isNotFound(Object.assign(new Error('not_found'), { status: 404 }))).toBe(true);
    expect(isNotFound(new Error('boom'))).toBe(false);
    expect(isNotFound(null)).toBe(false);
  });
  it('takes a first name', () => {
    expect(firstName('Priya Raman')).toBe('Priya');
    expect(firstName('  Arjun ')).toBe('Arjun');
  });
});
