import { describe, expect, it } from 'vitest';
import { dailyDigestDueDay, digestSendMinute } from '@/lib/digest/daily-digest';

const base = { quietHours: true, quietStart: '21:00', quietEnd: '08:00', tz: 'Asia/Kolkata' };

describe('daily digest timing', () => {
  it('sends in the hour of the chosen time', () => {
    const p = { ...base, digestTime: '09:30' };
    expect(dailyDigestDueDay(p, new Date('2026-10-29T09:05:00+05:30'))).toBe('2026-10-29');
    expect(dailyDigestDueDay(p, new Date('2026-10-29T10:05:00+05:30'))).toBeNull();
  });

  it('moves a time inside quiet hours to the end of the window', () => {
    expect(digestSendMinute({ ...base, digestTime: '06:00' })).toBe(8 * 60);
    expect(digestSendMinute({ ...base, digestTime: '22:15' })).toBe(8 * 60);
    expect(digestSendMinute({ ...base, quietHours: false, digestTime: '06:00' })).toBe(6 * 60);
    expect(dailyDigestDueDay({ ...base, digestTime: '06:00' }, new Date('2026-10-29T08:00:00+05:30'))).toBe('2026-10-29');
  });

  it('sends nothing without a digest time', () => {
    expect(dailyDigestDueDay({ ...base, digestTime: null }, new Date('2026-10-29T09:00:00+05:30'))).toBeNull();
  });
});

import { clientDigestSections, digestWeek, type WeeklyDigest } from '@/lib/digest/weekly-digest';
import { buildWeeklyDigestEmail } from '@/lib/digest/weekly-digest-email';

describe('daily digest email', () => {
  it('reuses the weekly builder with daily words', () => {
    const now = new Date('2026-11-02T02:30:00Z');
    const d: WeeklyDigest = {
      audience: 'client',
      recipientName: 'Asha Rao',
      week: digestWeek(now),
      settingsHref: '/app/client/settings',
      sections: clientDigestSections({
        today: '2026-11-02',
        filings: [{ id: 'late', name: 'GSTR-3B', period: 'Sep 2026', companyName: 'Acme', dueDate: '2026-10-14', filedOn: null }],
        needs: [],
        activity: [],
      }),
    };
    const copy = buildWeeklyDigestEmail(d, 'daily')!;
    expect(copy.subject).toBe('Your open items today: 1 overdue');
    expect(copy.text).toContain('Here is what is open for you today.');
    expect(copy.text).toContain('clear the daily digest time');
    expect(copy.html).toContain('Daily digest');
    expect(buildWeeklyDigestEmail(d)!.subject).toBe('Your week from 2 Nov: 1 overdue');
  });
});
