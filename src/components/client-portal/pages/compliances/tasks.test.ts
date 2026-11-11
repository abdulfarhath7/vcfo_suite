import { describe, expect, it } from 'vitest';
import { dayWords, doneTaskRows, expiryAsRow, isExpiryRow, isTaskRow, normStage, taskAsRow, taskCal, taskHint, taskWord, weekGroups, weekOf, type ClientTask } from './tasks';
import type { ExpiryItem } from '@/hooks/use-expiries';

const TODAY = '2026-10-14'; // a Wednesday

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

describe('client tasks', () => {
  it('reads every stage spelling', () => {
    expect(normStage('In progress')).toBe('in_progress');
    expect(normStage('submitted-for-review')).toBe('review');
    expect(normStage('Waiting for client')).toBe('waiting');
    expect(normStage('nonsense')).toBe('not_started');
  });

  it('maps stages to the six words, with Overdue and Due soon from the end date', () => {
    expect(taskWord(task(), TODAY)).toBe('In progress');
    expect(taskWord(task({ stage: 'waiting' }), TODAY)).toBe('Waiting');
    expect(taskWord(task({ stage: 'not_started', endDate: '2026-10-18' }), TODAY)).toBe('Due soon');
    expect(taskWord(task({ stage: 'not_started', endDate: '2026-11-30' }), TODAY)).toBe('Not started');
    expect(taskWord(task({ endDate: '2026-10-13' }), TODAY)).toBe('Overdue');
    expect(taskWord(task({ stage: 'completed', endDate: '2026-10-01' }), TODAY)).toBe('Done');
  });

  it('gives the calendar state and the hover text', () => {
    expect(taskCal(task(), TODAY)).toBe('due');
    expect(taskCal(task({ endDate: '2026-12-01' }), TODAY)).toBe('up');
    expect(taskCal(task({ endDate: '2026-10-01' }), TODAY)).toBe('over');
    expect(taskCal(task({ stage: 'completed' }), TODAY)).toBe('ok');
    expect(taskHint(task())).toBe('Starts 10 Oct · High');
  });

  it('groups by end-date week from Monday', () => {
    expect(weekOf(task({ endDate: '2026-10-18' }), TODAY)).toBe('This week');
    expect(weekOf(task({ endDate: '2026-10-19' }), TODAY)).toBe('Next week');
    expect(weekOf(task({ endDate: '2026-10-26' }), TODAY)).toBe('Later');
    expect(weekOf(task({ stage: 'completed' }), TODAY)).toBe('Done');
    const g = weekGroups([task({ id: 'a', endDate: '2026-10-30' }), task({ id: 'b', endDate: '2026-10-15' })], TODAY);
    expect(g.map((x) => x.id)).toEqual(['This week', 'Later']);
  });

  it('turns a task into a calendar row on its end date and lists only done tasks on Filings', () => {
    const r = taskAsRow(task());
    expect(isTaskRow(r)).toBe(true);
    expect(r.dueDate).toBe('2026-10-20');
    expect(r.windowFrom).toBe('2026-10-10');
    expect(r.filedOn).toBeNull();
    const done = doneTaskRows([task(), task({ id: 't2', stage: 'completed', completedOn: '2026-10-12', deliverable: { id: 'f', fileName: 'mis.pdf' } })]);
    expect(done).toHaveLength(1);
    expect(done[0]!.filedOn).toBe('2026-10-12');
    expect(done[0]!.proofCount).toBe(1);
  });
});

describe('expiries on the client calendar', () => {
  const item = {
    id: 'x1',
    engagementId: 'e1',
    companyName: 'Acme',
    subjectKind: 'person',
    subjectName: 'Ravi Kumar',
    kind: 'dsc',
    kindLabel: 'DSC',
    referenceLabel: 'DIN 01234567',
    expiresOn: '2026-11-14',
    daysLeft: 3,
    band: 'red',
    source: 'checklist',
    renewedAt: null,
    notes: null,
    lastAlertStage: null,
    requestListId: null,
    updatedAt: '2026-11-11T00:00:00Z',
  } as ExpiryItem;

  it('draws an expiry like a task on its date, says the days left, and counts it as an expiry', () => {
    const row = expiryAsRow(item);
    expect(row).toMatchObject({ id: 'expiry:x1', name: 'DSC expires · Ravi Kumar', dueDate: '2026-11-14', companyName: 'Acme', period: '3 days left' });
    expect(isTaskRow(row) && isExpiryRow(row)).toBe(true);
    expect(isExpiryRow(taskAsRow({ ...row.task, expiry: null }))).toBe(false);
    expect(taskHint(row.task)).toBe('3 days left');
    expect(taskCal(row.task, '2026-11-11')).toBe('due');
    expect(dayWords([row, taskAsRow({ ...row.task, id: 't1', expiry: null })])).toBe('1 task · 1 expiry');
  });
});
