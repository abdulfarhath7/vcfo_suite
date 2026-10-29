import { isClockTime } from '@/lib/notify/prefs-gate';

/**
 * DAILY DIGEST timing (P-626, S-656). A person who set `notification_prefs.digest_time`
 * ("HH:MM", their own time zone) gets a summary of their open items once a day. The job runs
 * hourly and sends in the hour that holds the chosen time. When the chosen time falls inside
 * the person's quiet hours, it moves to the end of the quiet window instead.
 *
 * Pure: no database.
 */

export interface DigestTimePrefs {
  digestTime: string | null;
  quietHours: boolean;
  quietStart: string;
  quietEnd: string;
  tz: string;
}

const minutesOf = (clock: string) => {
  const [h, m] = clock.split(':').map(Number) as [number, number];
  return h * 60 + m;
};

function local(now: Date, tz: string): { minutes: number; day: string } {
  const read = (zone: string) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
    return { minutes: Number(get('hour')) * 60 + Number(get('minute')), day: `${get('year')}-${get('month')}-${get('day')}` };
  };
  try {
    return read(tz || 'Asia/Kolkata');
  } catch {
    return read('Asia/Kolkata');
  }
}

/** The minute of the day the digest goes out: the chosen time, or the quiet window's end. */
export function digestSendMinute(p: DigestTimePrefs): number | null {
  if (!isClockTime(p.digestTime)) return null;
  const at = minutesOf(p.digestTime);
  if (!p.quietHours || !isClockTime(p.quietStart) || !isClockTime(p.quietEnd)) return at;
  const start = minutesOf(p.quietStart);
  const end = minutesOf(p.quietEnd);
  if (start === end) return at;
  const inside = start < end ? at >= start && at < end : at >= start || at < end;
  return inside ? end : at;
}

/** The person's local day ("2026-10-29") when their digest is due in this hour, else null. */
export function dailyDigestDueDay(p: DigestTimePrefs, now: Date): string | null {
  const send = digestSendMinute(p);
  if (send === null) return null;
  const { minutes, day } = local(now, p.tz);
  return Math.floor(send / 60) === Math.floor(minutes / 60) ? day : null;
}
