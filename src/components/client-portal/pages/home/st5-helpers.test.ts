import { describe, expect, it } from 'vitest';
import type { PortalStep } from '@/lib/client-portal/step-model';
import { holderOf, markState, markTone, stepChip, stepSub, urgencyOf } from '../incorporation/spectrum';

/* The ST5 rows on Home and Incorporation read these helpers; they turn the real step kinds
   into the six status words (R-13) and the step marks (R-22). */

function step(p: Partial<PortalStep>): PortalStep {
  return { n: 7, id: 'pre-7', title: 'Registered office', owner: 'client', kind: 'up', late: false, lateDays: 0, ...p } as PortalStep;
}

describe('ST5 helpers', () => {
  it('maps step kinds to the six status words', () => {
    expect(stepChip(step({ kind: 'done' }))).toEqual({ tone: 'ok', label: 'Done' });
    expect(stepChip(step({ kind: 'up' }))).toEqual({ tone: 'idle', label: 'Not started' });
    expect(stepChip(step({ kind: 'next' })).label).toBe('Not started');
    expect(stepChip(step({ kind: 'you' }))).toEqual({ tone: 'teal', label: 'Waiting' });
    expect(stepChip(step({ kind: 'with', owner: 'sbc' }))).toEqual({ tone: 'prog', label: 'In progress' });
    expect(stepChip(step({ kind: 'prog', late: true }))).toEqual({ tone: 'bad', label: 'Overdue' });
  });

  it('draws done, live and upcoming marks', () => {
    expect(markState(step({ kind: 'done' }))).toBe('done');
    expect(markState(step({ kind: 'with' }))).toBe('now');
    expect(markState(step({ kind: 'up' }))).toBe('next');
    expect(markTone(step({ kind: 'you' }))).toBe('teal');
    expect(markTone(step({ kind: 'with', late: true }))).toBe('bad');
  });

  it('names who holds a live step', () => {
    expect(holderOf(step({ kind: 'you', owner: 'sbc' }), 'Northwind')).toBe('Northwind');
    expect(holderOf(step({ kind: 'with', owner: 'sbc' }), 'Northwind')).toBe('SBC');
    expect(holderOf(step({ kind: 'with', owner: 'mca' }), 'Northwind')).toBe('MCA');
  });

  it('writes the line under a step title', () => {
    expect(stepSub(step({ kind: 'done', doneOn: '2026-09-26' }), undefined, 'Northwind').text).toBe('Done 26 Sep');
    expect(stepSub(step({ kind: 'up' }), step({ n: 10 }), 'Northwind').text).toBe('Starts after step 10');
    expect(stepSub(step({ kind: 'you', due: '2026-10-09' }), undefined, 'Northwind').text).toBe('With Northwind · due 9 Oct');
  });

  it('tints date tiles by urgency', () => {
    expect(urgencyOf('2026-10-06', '2026-10-01')).toBe('bad');
    expect(urgencyOf('2026-10-06', '2026-10-10')).toBe('warn');
    expect(urgencyOf('2026-10-06', '2026-10-20')).toBe('prog');
    expect(urgencyOf('2026-10-06', '2026-12-20')).toBe('idle');
  });
});
