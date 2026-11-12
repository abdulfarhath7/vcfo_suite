import { describe, expect, it } from 'vitest';
import { buildIncorporationModel } from './step-model';
import { countLateSteps, isLockedStepKind, isOpenLateStep, isStepLate } from './step-late';

const win = (from: string, to: string) => ({ from, to, setBy: 'm', setAt: '2026-09-01T00:00:00Z' });

describe('isStepLate', () => {
  it('is never true for a locked or done step, even past its window end', () => {
    expect(isLockedStepKind('up')).toBe(true);
    expect(isLockedStepKind('next')).toBe(true);
    expect(isStepLate({ kind: 'up', due: '2026-10-01' }, '2026-11-01')).toBe(false);
    expect(isStepLate({ kind: 'next', status: 'overdue', due: '2026-10-01' }, '2026-11-01')).toBe(false);
    expect(isStepLate({ kind: 'done', due: '2026-10-01' }, '2026-11-01')).toBe(false);
  });

  it('is true for an open step past its window end or marked overdue, as before', () => {
    expect(isStepLate({ kind: 'you', due: '2026-10-01' }, '2026-11-01')).toBe(true);
    expect(isStepLate({ kind: 'with', status: 'overdue' }, '2026-11-01')).toBe(true);
    expect(isStepLate({ kind: 'prog', due: '2026-12-01' }, '2026-11-01')).toBe(false);
  });

  it('counts only open late steps', () => {
    const steps = [
      { kind: 'up' as const, late: true },
      { kind: 'you' as const, late: true },
      { kind: 'done' as const, late: true },
      { kind: 'with' as const, late: false },
    ];
    expect(isOpenLateStep(steps[0]!)).toBe(false);
    expect(countLateSteps(steps)).toBe(1);
  });
});

describe('buildIncorporationModel late overlay', () => {
  const schedule = {
    steps: {
      'pre-1': win('2026-09-01', '2026-09-20'),
      'post-1': win('2026-09-01', '2026-09-20'),
      'reg-1': win('2026-09-01', '2026-09-20'),
    },
  };

  it('does not mark locked Phase 3 and 4 steps late before COI', () => {
    const m = buildIncorporationModel({}, schedule, '2026-11-01');
    for (const id of ['post-1', 'reg-1']) {
      const s = m.byId[id]!;
      expect(isLockedStepKind(s.kind)).toBe(true);
      expect(s.late).toBe(false);
      expect(s.lateDays).toBe(0);
    }
  });

  it('still marks the open step late when its window end has passed', () => {
    const m = buildIncorporationModel({}, schedule, '2026-11-01');
    const s = m.byId['pre-1']!;
    expect(isLockedStepKind(s.kind)).toBe(false);
    expect(s.late).toBe(true);
    expect(s.lateDays).toBeGreaterThan(0);
    expect(m.counts.late).toBe(1);
  });
});
