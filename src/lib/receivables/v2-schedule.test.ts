import { describe, expect, it } from 'vitest';
import { nextRollupAt, rollupDue } from './v2-schedule';

// 17 Nov 2026 is a Tuesday. 10:30 IST = 05:00 UTC.
const at = (iso: string) => new Date(iso);
const base = { digestEnabled: false, digestWeekday: 1, digestHourIst: 9, rollupEveryDays: 3, sendHourIst: 10, emailRollupEnabled: true };

describe('roll-up by picked weekdays', () => {
  it('sends on a picked day from the send hour, once that day', () => {
    const s = { ...base, rollupWeekdays: [2, 5] };
    expect(rollupDue(s, null, at('2026-11-17T05:00:00Z'))).toBe(true);
    expect(rollupDue(s, '2026-11-17', at('2026-11-17T05:00:00Z'))).toBe(false);
    expect(rollupDue(s, null, at('2026-11-17T03:00:00Z'))).toBe(false); // 08:30 IST
    expect(rollupDue({ ...s, rollupWeekdays: [1, 4] }, null, at('2026-11-17T05:00:00Z'))).toBe(false);
  });

  it('names the next picked day', () => {
    const s = { ...base, rollupWeekdays: [1, 4] };
    expect(nextRollupAt(s, null, at('2026-11-17T05:00:00Z'))).toBe('2026-11-19T04:30:00.000Z'); // Thu 10:00 IST
  });
});
