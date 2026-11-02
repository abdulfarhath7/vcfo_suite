import { describe, expect, it } from 'vitest';
import {
  clientHealthCounts,
  plainDay,
  projectHealth,
  stepsCompletedPerWeek,
  workloadByLead,
  type AnalyticsProject,
} from './analytics-stats';

const ids = ['a', 'b', 'c'];

describe('analytics stats', () => {
  it('labels days plainly', () => {
    expect(plainDay(new Date(2026, 9, 14))).toBe('14 Oct');
  });

  it('counts completed steps per week, oldest first', () => {
    const today = new Date(2026, 9, 29); // Thursday; the week starts Monday 26 Oct.
    const projects: AnalyticsProject[] = [
      {
        internId: 'l1',
        state: {
          a: { status: 'completed', completedOn: '2026-10-27' },
          b: { status: 'completed', completedOn: '2026-10-20' },
          c: { status: 'completed', completedOn: '2026-01-01' },
        },
      },
    ];
    const weeks = stepsCompletedPerWeek(projects, ids, today, 3);
    expect(weeks).toEqual([
      { w: '12 Oct', steps: 0 },
      { w: '19 Oct', steps: 1 },
      { w: '26 Oct', steps: 1 },
    ]);
  });

  it('picks one health word per project', () => {
    expect(projectHealth({ internId: '', state: { a: { status: 'overdue' }, b: { status: 'awaiting-client' } } }, ids)).toBe('overdue');
    expect(projectHealth({ internId: '', state: { a: { status: 'awaiting-client' } } }, ids)).toBe('waiting');
    expect(projectHealth({ internId: '', state: { a: { status: 'completed' } } }, ids)).toBe('progress');
    expect(projectHealth({ internId: '', state: {} }, ids)).toBe('notStarted');
    expect(
      projectHealth(
        { internId: '', state: { a: { status: 'completed' }, b: { status: 'completed' }, c: { status: 'not-applicable' } } },
        ids,
      ),
    ).toBe('done');
    expect(clientHealthCounts([{ internId: '', state: {} }], ids).notStarted).toBe(1);
  });

  it('splits open steps per lead and skips unknown people', () => {
    const rows = workloadByLead(
      [
        { internId: 'l1', state: { a: { status: 'overdue' }, b: { status: 'in-progress', assigneeId: 'l2' }, c: { status: 'completed' } } },
        { internId: 'ghost', state: {} },
      ],
      ids,
      [
        { id: 'l1', name: 'Asha' },
        { id: 'l2', name: 'Bilal' },
      ],
    );
    expect(rows).toEqual([
      { id: 'l1', name: 'Asha', overdue: 1, waiting: 0, progress: 0, notStarted: 0, open: 1 },
      { id: 'l2', name: 'Bilal', overdue: 0, waiting: 0, progress: 1, notStarted: 0, open: 1 },
    ]);
  });
});
