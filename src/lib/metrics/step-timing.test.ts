import { describe, expect, it } from 'vitest';
import {
  diffStepStatuses,
  median,
  stageAverages,
  stepTimeRows,
  timingOf,
  type StepEvent,
  type StepTiming,
} from '@/lib/metrics/step-timing';

const NOW = new Date('2026-10-29T10:00:00.000Z');

function ev(stepId: string, toStatus: string, at: string, fromStatus: string | null = null): StepEvent {
  return { engagementId: 'e1', stepId, fromStatus, toStatus, at };
}

describe('diffStepStatuses', () => {
  it('reports only steps whose status changed', () => {
    const changes = diffStepStatuses(
      { a: { status: 'not-started' }, b: { status: 'in-progress' }, c: { status: 'completed' } },
      { a: { status: 'in-progress' }, b: { status: 'in-progress', responses: { x: '1' } }, c: { status: 'completed' } },
    );
    expect(changes).toEqual([{ stepId: 'a', from: 'not-started', to: 'in-progress' }]);
  });

  it('treats a new slice with no status as not started, so answers alone are not a change', () => {
    expect(diffStepStatuses({}, { a: { responses: { x: '1' } } })).toEqual([]);
    expect(diffStepStatuses(null, { a: { status: 'awaiting-client' } })).toEqual([
      { stepId: 'a', from: null, to: 'awaiting-client' },
    ]);
  });
});

describe('timingOf', () => {
  it('opens on the first move out of not started and finishes on completion', () => {
    const t = timingOf(
      [
        ev('a', 'in-progress', '2026-10-01T09:00:00.000Z', 'not-started'),
        ev('a', 'awaiting-client', '2026-10-03T09:00:00.000Z', 'in-progress'),
        ev('a', 'completed', '2026-10-08T09:00:00.000Z', 'awaiting-client'),
      ],
      NOW,
    );
    expect(t.openedAt).toBe('2026-10-01T09:00:00.000Z');
    expect(t.finishedAt).toBe('2026-10-08T09:00:00.000Z');
    expect(t.daysInStep).toBe(7);
  });

  it('counts to today while the step is open, and a reopen clears the finish', () => {
    const t = timingOf(
      [
        ev('a', 'in-progress', '2026-10-19T09:00:00.000Z'),
        ev('a', 'completed', '2026-10-20T09:00:00.000Z'),
        ev('a', 'in-progress', '2026-10-21T09:00:00.000Z'),
      ],
      NOW,
    );
    expect(t.finishedAt).toBeNull();
    expect(t.daysInStep).toBe(10);
  });

  it('gives no days for a step that was never opened or is not needed', () => {
    expect(timingOf([], NOW).daysInStep).toBeNull();
    expect(timingOf([ev('a', 'not-applicable', '2026-10-01T00:00:00.000Z')], NOW).daysInStep).toBeNull();
  });
});

describe('stageAverages', () => {
  const finished = (openedAt: string, finishedAt: string): StepTiming => ({
    openedAt,
    finishedAt,
    daysInStep: 0,
    lastStatus: 'completed',
  });
  const open = (openedAt: string): StepTiming => ({ openedAt, finishedAt: null, daysInStep: 0, lastStatus: 'in-progress' });

  it('averages finished stages in the window and names the slowest open one', () => {
    const timings = new Map<string, Record<string, StepTiming>>([
      ['e1', { s1: finished('2026-09-01T00:00:00Z', '2026-09-03T00:00:00Z'), s2: finished('2026-09-02T00:00:00Z', '2026-09-11T00:00:00Z') }],
      ['e2', { s1: finished('2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z'), s2: finished('2026-10-02T00:00:00Z', '2026-10-06T00:00:00Z') }],
      ['e3', { s1: open('2026-10-09T00:00:00Z') }],
      ['e4', { s1: open('2026-10-19T00:00:00Z') }],
    ]);
    const [stage] = stageAverages({
      phases: [{ id: 'p1', label: 'Stage one', stepIds: ['s1', 's2'] }],
      timings,
      since: new Date('2026-01-01T00:00:00Z'),
      now: NOW,
    });
    // e1: 1 Sep to 11 Sep = 10 days; e2: 1 Oct to 6 Oct = 5 days.
    expect(stage.avgDays).toBe(8);
    expect(stage.finished).toBe(2);
    expect(stage.slowest).toEqual({ engagementId: 'e3', days: 20 });
  });

  it('leaves out stages that finished before the window', () => {
    const timings = new Map<string, Record<string, StepTiming>>([
      ['e1', { s1: finished('2025-01-01T00:00:00Z', '2025-01-05T00:00:00Z') }],
    ]);
    const [stage] = stageAverages({
      phases: [{ id: 'p1', label: 'Stage one', stepIds: ['s1'] }],
      timings,
      since: new Date('2026-01-01T00:00:00Z'),
      now: NOW,
    });
    expect(stage.avgDays).toBeNull();
    expect(stage.slowest).toBeNull();
  });
});

describe('stepTimeRows and median', () => {
  it('takes the median of finished steps and the longest open one', () => {
    const t = (daysInStep: number, finishedAt: string | null): StepTiming => ({
      openedAt: '2026-10-01T00:00:00Z',
      finishedAt,
      daysInStep,
      lastStatus: finishedAt ? 'completed' : 'in-progress',
    });
    const rows = stepTimeRows({
      stepIds: ['s1', 's2'],
      timings: new Map([
        ['e1', { s1: t(2, '2026-10-03T00:00:00Z') }],
        ['e2', { s1: t(6, '2026-10-07T00:00:00Z') }],
        ['e3', { s1: t(9, null) }],
      ]),
      since: new Date('2026-01-01T00:00:00Z'),
    });
    expect(rows).toEqual([{ stepId: 's1', medianDays: 4, finished: 2, longest: { engagementId: 'e3', days: 9 } }]);
    expect(median([5, 1, 3])).toBe(3);
    expect(median([])).toBeNull();
  });
});
