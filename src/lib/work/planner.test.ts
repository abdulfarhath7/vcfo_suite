import { describe, expect, it } from 'vitest';
import {
  addDaysYmd,
  dayLoadHours,
  dayMonth,
  hourLabel,
  istHourOf,
  istIso,
  istTimeOf,
  istYmdOf,
  isValidBlockRange,
  mondayOf,
  placeBlock,
  suggestWeekBlocks,
  timeRangeLabel,
  weekOf,
  weekdayShort,
} from '@/lib/work/planner';

describe('IST helpers', () => {
  it('round-trips an IST wall time', () => {
    const iso = istIso('2026-10-29', '10:30');
    expect(iso).toBe('2026-10-29T05:00:00.000Z');
    expect(istYmdOf(iso)).toBe('2026-10-29');
    expect(istTimeOf(iso)).toBe('10:30');
    expect(istHourOf(iso)).toBe(10.5);
  });

  it('reads a late UTC evening as the next IST day', () => {
    expect(istYmdOf('2026-10-29T20:00:00.000Z')).toBe('2026-10-30');
  });

  it('builds a Monday-first week', () => {
    expect(weekdayShort('2026-10-29')).toBe('Thu');
    expect(mondayOf('2026-10-29')).toBe('2026-10-26');
    expect(mondayOf('2026-11-01')).toBe('2026-10-26');
    expect(weekOf('2026-10-29')).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
    expect(addDaysYmd('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('writes plain labels', () => {
    expect(dayMonth('2026-10-14')).toBe('14 Oct');
    expect(hourLabel(9)).toBe('9 AM');
    expect(hourLabel(12)).toBe('12 PM');
    expect(hourLabel(18)).toBe('6 PM');
    expect(timeRangeLabel(istIso('2026-10-29', '10:00'), istIso('2026-10-29', '11:30'))).toBe('10:00 to 11:30');
  });
});

describe('isValidBlockRange', () => {
  const at = (hhmm: string) => istIso('2026-10-29', hhmm);
  it('accepts a same-day block of 15 minutes to 12 hours', () => {
    expect(isValidBlockRange(at('10:00'), at('10:15'))).toBe(true);
    expect(isValidBlockRange(at('08:00'), at('20:00'))).toBe(true);
  });
  it('refuses empty, reversed, short, long and overnight blocks', () => {
    expect(isValidBlockRange(at('10:00'), at('10:00'))).toBe(false);
    expect(isValidBlockRange(at('11:00'), at('10:00'))).toBe(false);
    expect(isValidBlockRange(at('10:00'), at('10:10'))).toBe(false);
    expect(isValidBlockRange(at('07:00'), at('19:30'))).toBe(false);
    expect(isValidBlockRange(at('22:00'), istIso('2026-10-30', '01:00'))).toBe(false);
    expect(isValidBlockRange('nope', at('10:00'))).toBe(false);
  });
  it('allows a block that ends at midnight', () => {
    expect(isValidBlockRange(at('22:00'), istIso('2026-10-30', '00:00'))).toBe(true);
  });
});

describe('placeBlock', () => {
  const days = weekOf('2026-10-29');
  it('places a block by IST day and hour', () => {
    expect(placeBlock({ startsAt: istIso('2026-10-29', '10:00'), endsAt: istIso('2026-10-29', '11:30') }, days)).toEqual({
      dayIdx: 3,
      top: 2,
      height: 1.5,
    });
  });
  it('clips to the grid and drops blocks off it', () => {
    expect(placeBlock({ startsAt: istIso('2026-10-26', '07:00'), endsAt: istIso('2026-10-26', '09:00') }, days)).toEqual({
      dayIdx: 0,
      top: 0,
      height: 1,
    });
    expect(placeBlock({ startsAt: istIso('2026-10-26', '06:00'), endsAt: istIso('2026-10-26', '07:00') }, days)).toBeNull();
    expect(placeBlock({ startsAt: istIso('2026-11-02', '10:00'), endsAt: istIso('2026-11-02', '11:00') }, days)).toBeNull();
  });
});

describe('dayLoadHours', () => {
  it('sums planned hours per day', () => {
    const days = weekOf('2026-10-29');
    const load = dayLoadHours(
      [
        { startsAt: istIso('2026-10-26', '10:00'), endsAt: istIso('2026-10-26', '12:00') },
        { startsAt: istIso('2026-10-26', '14:00'), endsAt: istIso('2026-10-26', '14:30') },
      ],
      days,
    );
    expect(load[0]).toBe(2.5);
    expect(load[1]).toBe(0);
  });
});

describe('suggestWeekBlocks', () => {
  const days = weekOf('2026-10-26');
  const monday9 = new Date(istIso('2026-10-26', '09:00'));

  it('places overdue items first, then by due date, in free slots', () => {
    const out = suggestWeekBlocks({
      candidates: [
        { itemKey: 'request:b', title: 'Later', dueYmd: '2026-10-30', overdue: false },
        { itemKey: 'request:a', title: 'Late', dueYmd: '2026-10-20', overdue: true },
      ],
      busy: [{ startsAt: istIso('2026-10-26', '10:00'), endsAt: istIso('2026-10-26', '11:00') }],
      days,
      now: monday9,
    });
    expect(out.map((b) => b.itemKey)).toEqual(['request:a', 'request:b']);
    expect(istTimeOf(out[0]!.startsAt)).toBe('11:00');
    expect(istTimeOf(out[1]!.startsAt)).toBe('12:00');
  });

  it('never plans in the past or on a weekend', () => {
    const fridayEvening = new Date(istIso('2026-10-30', '17:30'));
    const out = suggestWeekBlocks({
      candidates: [{ itemKey: 'request:a', title: 'A', overdue: false }],
      busy: [],
      days,
      now: fridayEvening,
    });
    expect(out).toEqual([]);
  });

  it('keeps a day under six planned hours', () => {
    const busy = [{ startsAt: istIso('2026-10-26', '10:00'), endsAt: istIso('2026-10-26', '15:30') }];
    const out = suggestWeekBlocks({
      candidates: [{ itemKey: 'request:a', title: 'A', overdue: false }],
      busy,
      days,
      now: monday9,
    });
    expect(istYmdOf(out[0]!.startsAt)).toBe('2026-10-27');
  });

  it('prefers a slot on or before the due date', () => {
    const busy = [{ startsAt: istIso('2026-10-26', '10:00'), endsAt: istIso('2026-10-26', '18:00') }];
    const out = suggestWeekBlocks({
      candidates: [{ itemKey: 'request:a', title: 'A', dueYmd: '2026-10-27', overdue: false }],
      busy,
      days,
      now: monday9,
    });
    expect(istYmdOf(out[0]!.startsAt)).toBe('2026-10-27');
  });
});

describe('suggestWeekBlocks options', () => {
  const days = weekOf('2026-10-26');
  const monday9 = new Date(istIso('2026-10-26', '09:00'));
  const two = [
    { itemKey: 'step:a', title: 'Step', client: 'Zeta', overdue: false },
    { itemKey: 'filing:b', title: 'Filing', client: 'Alpha', filing: true, overdue: false },
  ];

  it('keeps 9 to 11 AM free', () => {
    const out = suggestWeekBlocks({ candidates: [two[0]!], busy: [], days, now: new Date(istIso('2026-10-26', '08:00')), slotStart: 9, keepMorning: true });
    expect(out[0]!.startsAt).toBe(istIso('2026-10-26', '11:00'));
  });

  it('puts filings first, or groups by client', () => {
    expect(suggestWeekBlocks({ candidates: two, busy: [], days, now: monday9, filingsFirst: true })[0]!.itemKey).toBe('filing:b');
    expect(suggestWeekBlocks({ candidates: two, busy: [], days, now: monday9, groupByClient: true })[0]!.itemKey).toBe('filing:b');
    expect(suggestWeekBlocks({ candidates: two, busy: [], days, now: monday9 })[0]!.itemKey).toBe('step:a');
  });

  it('reshuffle starts on a later working day; the day cap can be raised', () => {
    const out = suggestWeekBlocks({ candidates: [two[0]!], busy: [], days, now: monday9, shuffle: 1 });
    expect(istYmdOf(out[0]!.startsAt)).toBe('2026-10-27');
    const busy = [{ startsAt: istIso('2026-10-26', '10:00'), endsAt: istIso('2026-10-26', '16:00') }];
    expect(istYmdOf(suggestWeekBlocks({ candidates: [two[0]!], busy, days, now: monday9 })[0]!.startsAt)).toBe('2026-10-27');
    expect(istYmdOf(suggestWeekBlocks({ candidates: [two[0]!], busy, days, now: monday9, maxDayHours: 8 })[0]!.startsAt)).toBe('2026-10-26');
  });
});
