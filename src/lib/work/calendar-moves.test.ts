import { describe, expect, it } from 'vitest';
import {
  LOCK_REASON,
  blockTimesFromWall,
  daysBetween,
  fromWallDate,
  isDraggable,
  isResizable,
  keyboardMove,
  moveDecision,
  requestedWindowForDrag,
  shiftPlannedDates,
  toWallIso,
} from '@/lib/work/calendar-moves';

const lead = { canEdit: true, canRequest: true };
const manager = { canEdit: true, canRequest: false };
const viewer = { canEdit: false, canRequest: false };

describe('moveDecision', () => {
  it('never moves a statutory due date, for any role', () => {
    for (const rights of [lead, manager, viewer]) {
      expect(moveDecision('statutory', rights)).toEqual({ action: 'locked', reason: LOCK_REASON.statutory });
      expect(isDraggable('statutory', rights)).toBe(false);
      expect(isResizable('statutory', rights)).toBe(false);
    }
  });

  it('turns a drag of a client-agreed date into a date-change request for a project lead', () => {
    expect(moveDecision('client-agreed', lead)).toEqual({ action: 'request' });
    expect(isDraggable('client-agreed', lead)).toBe(true);
    // A request asks for a new window; it never resizes in place.
    expect(isResizable('client-agreed', lead)).toBe(false);
  });

  it('keeps a client-agreed date locked for someone who cannot send a request', () => {
    expect(moveDecision('client-agreed', manager)).toEqual({ action: 'locked', reason: LOCK_REASON['client-agreed'] });
    expect(isDraggable('client-agreed', viewer)).toBe(false);
  });

  it('moves time blocks and planned dates freely for an editor', () => {
    expect(moveDecision('block', lead)).toEqual({ action: 'move' });
    expect(moveDecision('planned', manager)).toEqual({ action: 'move' });
    expect(isResizable('block', lead)).toBe(true);
  });

  it('keeps them still for a read-only viewer', () => {
    expect(moveDecision('block', viewer).action).toBe('locked');
    expect(isDraggable('planned', viewer)).toBe(false);
  });

  it('keeps workflow deadlines in place', () => {
    expect(moveDecision('due', lead)).toEqual({ action: 'locked', reason: LOCK_REASON.due });
  });
});

describe('requestedWindowForDrag', () => {
  it('shifts the whole window by the days dragged', () => {
    expect(requestedWindowForDrag({ from: '2026-11-02', to: '2026-11-06' }, '2026-11-06', '2026-11-09')).toEqual({
      fromDate: '2026-11-05',
      toDate: '2026-11-09',
    });
    expect(requestedWindowForDrag({ from: '2026-11-02', to: '2026-11-06' }, '2026-11-06', '2026-11-04')).toEqual({
      fromDate: '2026-10-31',
      toDate: '2026-11-04',
    });
  });

  it('asks for the new day alone when the item has no window', () => {
    expect(requestedWindowForDrag(null, '2026-11-06', '2026-11-10')).toEqual({ fromDate: '2026-11-10', toDate: '2026-11-10' });
  });

  it('asks for nothing when the item did not move', () => {
    expect(requestedWindowForDrag({ from: '2026-11-02', to: '2026-11-06' }, '2026-11-06', '2026-11-06')).toBeNull();
  });
});

describe('shiftPlannedDates', () => {
  it('moves both dates on a drag and only the end on a resize', () => {
    expect(shiftPlannedDates({ startDate: '2026-11-02', dueDate: '2026-11-06' }, 2, 2)).toEqual({ startDate: '2026-11-04', dueDate: '2026-11-08' });
    expect(shiftPlannedDates({ startDate: '2026-11-02', dueDate: '2026-11-06' }, 0, 3)).toEqual({ startDate: '2026-11-02', dueDate: '2026-11-09' });
  });

  it('refuses an end before the start and a no-op', () => {
    expect(shiftPlannedDates({ startDate: '2026-11-02', dueDate: '2026-11-06' }, 0, -5)).toBeNull();
    expect(shiftPlannedDates({ startDate: '2026-11-02', dueDate: '2026-11-06' }, 0, 0)).toBeNull();
  });
});

describe('wall clock', () => {
  it('round-trips an IST timestamp through the FullCalendar wall clock', () => {
    const stored = '2026-11-02T04:30:00.000Z'; // 10:00 IST
    expect(toWallIso(stored)).toBe('2026-11-02T10:00:00');
    expect(fromWallDate(new Date(`${toWallIso(stored)}Z`))).toBe(stored);
  });

  it('keeps a moved block inside its day', () => {
    const start = new Date('2026-11-02T10:00:00Z');
    expect(blockTimesFromWall(start, new Date('2026-11-02T11:30:00Z'))).toEqual({
      startsAt: '2026-11-02T04:30:00.000Z',
      endsAt: '2026-11-02T06:00:00.000Z',
    });
    expect(blockTimesFromWall(start, null)?.endsAt).toBe('2026-11-02T05:30:00.000Z');
    expect(blockTimesFromWall(new Date('2026-11-02T10:00:00Z'), new Date('2026-11-02T10:05:00Z'))).toBeNull();
  });

  it('counts whole days', () => {
    expect(daysBetween('2026-10-30', '2026-11-02')).toBe(3);
  });
});

describe('keyboardMove', () => {
  it('maps the arrow keys', () => {
    expect(keyboardMove('ArrowDown', false)).toEqual({ minutes: 15, days: 0, resize: false });
    expect(keyboardMove('ArrowUp', true)).toEqual({ minutes: -15, days: 0, resize: true });
    expect(keyboardMove('ArrowRight', false)).toEqual({ minutes: 0, days: 1, resize: false });
    expect(keyboardMove('ArrowLeft', true)).toBeNull();
    expect(keyboardMove('Enter', false)).toBeNull();
  });
});
