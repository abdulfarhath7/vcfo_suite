import { describe, expect, it } from 'vitest';
import {
  REMINDER_RULES,
  addDays,
  dueText,
  stageWord,
  taskCal,
  taskMatches,
  weekOf,
  type TaskLike,
} from '@/views/compliances/tasks/task-model';

// Fri 16 Oct 2026, noon UTC.
const NOW = new Date(Date.UTC(2026, 9, 16, 12));

function task(patch: Partial<TaskLike>): TaskLike {
  return {
    id: 't',
    name: 'MIS report',
    engagementId: 'acme',
    companyName: 'Acme',
    startDate: '2026-10-12',
    endDate: '2026-10-20',
    urgency: 'Medium',
    visibility: 'both',
    stage: 'in-progress',
    notifyDays: 5,
    ...patch,
  };
}

describe('stageWord', () => {
  it('maps the eight stages to the six words', () => {
    expect(stageWord('completed', '2026-10-01', 5, NOW)).toBe('Done');
    expect(stageWord('review', '2026-11-30', 5, NOW)).toBe('In progress');
    expect(stageWord('rework', '2026-11-30', 5, NOW)).toBe('In progress');
    expect(stageWord('waiting', '2026-11-30', 5, NOW)).toBe('Waiting');
    expect(stageWord('ready', '2026-11-30', 5, NOW)).toBe('Not started');
  });
  it('derives Overdue past the date and Due soon inside the reminder days', () => {
    expect(stageWord('in-progress', '2026-10-15', 5, NOW)).toBe('Overdue');
    expect(stageWord('not-started', '2026-10-19', 5, NOW)).toBe('Due soon');
    expect(stageWord('not-started', '2026-10-30', 5, NOW)).toBe('Not started');
  });
});

describe('weekOf', () => {
  it('groups by the end-date week from Monday', () => {
    expect(weekOf(task({ endDate: '2026-10-18' }), NOW)).toBe('This week');
    expect(weekOf(task({ endDate: '2026-10-10' }), NOW)).toBe('This week');
    expect(weekOf(task({ endDate: '2026-10-19' }), NOW)).toBe('Next week');
    expect(weekOf(task({ endDate: '2026-11-02' }), NOW)).toBe('Later');
    expect(weekOf(task({ stage: 'completed' }), NOW)).toBe('Done');
  });
});

describe('taskMatches', () => {
  it('uses the statutory strip keys', () => {
    expect(taskMatches(task({ endDate: '2026-10-14' }), 'overdue', NOW)).toBe(true);
    expect(taskMatches(task({ endDate: '2026-10-18' }), 'soon', NOW)).toBe(true);
    expect(taskMatches(task({ stage: 'waiting' }), 'waiting', NOW)).toBe(true);
    expect(taskMatches(task({ stage: 'completed' }), 'done', NOW)).toBe(true);
    expect(taskMatches(task({ stage: 'ready', endDate: '2026-11-30' }), 'none', NOW)).toBe(true);
    expect(taskMatches(task({}), '', NOW)).toBe(true);
  });
});

describe('dates', () => {
  it('reads days to due', () => {
    expect(dueText('2026-10-20', NOW, false)).toBe('Due in 4 days');
    expect(dueText('2026-10-15', NOW, false)).toBe('1 day overdue');
    expect(dueText('2026-10-16', NOW, false)).toBe('Due today');
    expect(dueText('2026-10-16', NOW, true, 'Filed')).toBe('Filed');
  });
  it('dates the six reminders', () => {
    const due = '2026-10-20';
    expect(REMINDER_RULES.map((r) => addDays(due, r.offset(5)))).toEqual([
      '2026-10-15',
      '2026-10-18',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-25',
    ]);
  });
  it('puts a task in the calendar statuses', () => {
    expect(taskCal(task({ endDate: '2026-10-14' }), NOW)).toBe('overdue');
    expect(taskCal(task({ endDate: '2026-10-22' }), NOW)).toBe('due-soon');
    expect(taskCal(task({ endDate: '2026-11-22' }), NOW)).toBe('upcoming');
    expect(taskCal(task({ stage: 'completed' }), NOW)).toBe('filed');
  });
});
