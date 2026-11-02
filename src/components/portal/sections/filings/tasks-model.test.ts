import { describe, expect, it } from 'vitest';
import type { PortalFiling } from '@/lib/client-portal/compliances';
import { taskAsRow, type ClientTask } from '@/components/client-portal/pages/compliances/tasks';
import { catCounts, catSearch, mergeRows, readCat, rowWords, statOnly, taskNextLine, tasksInFy, taskTitle, WORD_PILL } from './tasks-model';

const TODAY = '2026-10-14';

function filing(id: string, dueDate: string, area: PortalFiling['area'] = 'GST'): PortalFiling {
  return {
    id,
    engagementId: 'e',
    companyName: 'Co',
    particular: id,
    name: id,
    area,
    authority: area,
    authorityName: area,
    frequency: 'monthly',
    freqLabel: 'Monthly',
    dueDate,
    filedOn: null,
    period: 'Sep 2026',
    periodLong: null,
    fyLabel: null,
    rawStatus: 'upcoming',
    windowFrom: null,
    windowTo: null,
    penaltyRisk: 'low',
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
  };
}

function task(p: Partial<ClientTask> = {}): ClientTask {
  return {
    id: 't1',
    name: 'MIS report · September',
    activityName: 'MIS',
    startDate: '2026-10-10',
    endDate: '2026-10-20',
    urgency: 'high',
    visibility: 'both',
    stage: 'in_progress',
    completedOn: null,
    ownerName: 'Bharath',
    notifyDays: 5,
    deliverable: null,
    ...p,
  };
}

describe('?cat= in the URL', () => {
  it('reads All unless the value is one of the two categories', () => {
    expect(readCat('')).toBe('all');
    expect(readCat('?cat=statutory')).toBe('statutory');
    expect(readCat('cat=non-statutory&filing=x')).toBe('non-statutory');
    expect(readCat('?cat=weird')).toBe('all');
  });

  it('sets cat, drops it for All and keeps the other parameters', () => {
    expect(catSearch('?filing=abc', 'statutory')).toBe('?filing=abc&cat=statutory');
    expect(catSearch('?cat=statutory&filing=abc', 'all')).toBe('?filing=abc');
    expect(catSearch('?cat=statutory', 'all')).toBe('');
    expect(catSearch('', 'non-statutory')).toBe('?cat=non-statutory');
  });
});

describe('merging register rows and task rows', () => {
  const stat = [filing('a', '2026-10-20'), filing('b', '2026-11-11', 'MCA')];
  const tasks = [taskAsRow(task()), taskAsRow(task({ id: 't2', endDate: '2027-05-02' }))];

  it('follows the switch and hides tasks under an area pick', () => {
    expect(mergeRows(stat, tasks, 'all', 'all')).toHaveLength(4);
    expect(mergeRows(stat, tasks, 'statutory', 'all')).toHaveLength(2);
    expect(mergeRows(stat, tasks, 'non-statutory', 'all').every((r) => 'task' in r)).toBe(true);
    expect(mergeRows(stat, tasks, 'all', 'GST')).toHaveLength(2);
    expect(mergeRows(stat, tasks, 'all', 'GST').some((r) => 'task' in r)).toBe(false);
  });

  it('keeps tasks to the FY of their end date and splits statutory rows back out', () => {
    expect(tasksInFy(tasks, 2026).map((r) => r.id)).toEqual(['task:t1']);
    expect(tasksInFy(tasks, 2027).map((r) => r.id)).toEqual(['task:t2']);
    const merged = mergeRows(stat, tasks, 'all', 'all');
    expect(statOnly(merged).map((r) => r.id)).toEqual(['a', 'b']);
    expect(catCounts(stat, tasks)).toEqual({ stat: 2, ns: 2 });
  });

  it('counts filings and tasks in words', () => {
    expect(rowWords([])).toBe('0 filings');
    expect(rowWords([stat[0]!])).toBe('1 filing');
    expect(rowWords([...stat, tasks[0]!])).toBe('2 filings · 1 task');
    expect(rowWords(tasks)).toBe('2 tasks');
  });
});

describe('task words on the portal', () => {
  it('maps the six words to pill kinds, red only for late work', () => {
    expect(WORD_PILL.Overdue).toBe('over');
    expect(WORD_PILL.Done).toBe('done');
    expect(WORD_PILL.Waiting).toBe('due');
    expect(WORD_PILL['Not started']).toBe('mut');
  });

  it('builds the hover text and the next-deadline line', () => {
    const r = taskAsRow(task());
    expect(taskTitle(r, TODAY)).toBe('MIS report · September · Starts 10 Oct · High · In progress');
    expect(taskNextLine(r)).toBe('Bharath at SBC');
    expect(taskNextLine(taskAsRow(task({ stage: 'waiting' })))).toBe('Your inputs needed');
    expect(taskNextLine(taskAsRow(task({ ownerName: null })))).toBe('SBC works on it');
  });
});
