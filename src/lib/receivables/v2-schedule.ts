import { addDaysIso, daysBetweenIso, todayIst } from './dates';

/**
 * RECEIVABLES v2 — when the automatic emails go (docs/specs/receivables/V2.md). Pure; the hourly
 * jobs and the People tab's "next send" line both use it.
 *
 *  - Roll-up (B): every `rollupEveryDays` days, counted from the last roll-up that went out, at
 *    `sendHourIst` IST or the first hourly run after it (a missed hour still sends later that day).
 *  - Leadership digest (C): on `digestWeekday` (0 = Sunday) at `digestHourIst` IST or later that day.
 * Each send's once-per-period key in the email log stops a second run from sending again.
 */

export type ScheduleSettings = {
  digestEnabled: boolean;
  digestWeekday: number;
  digestHourIst: number;
  rollupEveryDays: number;
  sendHourIst: number;
  emailRollupEnabled: boolean;
};

/** Today's IST date, hour (0–23) and weekday (0 = Sunday). */
export function istNow(now: Date = new Date()): { date: string; hour: number; weekday: number } {
  const ist = new Date(now.getTime() + 330 * 60_000);
  return { date: todayIst(now), hour: ist.getUTCHours(), weekday: ist.getUTCDay() };
}

function weekdayOf(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

/** `2026-11-17` at 9 IST → an ISO timestamp. */
function atIst(date: string, hour: number): string {
  return new Date(`${date}T${String(hour).padStart(2, '0')}:00:00+05:30`).toISOString();
}

/** True when the roll-up should go in this hourly run. */
export function rollupDue(s: ScheduleSettings, lastRollup: string | null, now: Date = new Date()): boolean {
  if (!s.emailRollupEnabled) return false;
  const t = istNow(now);
  if (t.hour < s.sendHourIst) return false;
  return !lastRollup || daysBetweenIso(lastRollup, t.date) >= Math.max(1, s.rollupEveryDays);
}

/** True when the leadership digest should go in this hourly run. */
export function digestDue(s: ScheduleSettings, now: Date = new Date()): boolean {
  if (!s.digestEnabled) return false;
  const t = istNow(now);
  return t.weekday === s.digestWeekday && t.hour >= s.digestHourIst;
}

/** When the next roll-up goes, or null while it is off. */
export function nextRollupAt(s: ScheduleSettings, lastRollup: string | null, now: Date = new Date()): string | null {
  if (!s.emailRollupEnabled) return null;
  const t = istNow(now);
  const every = Math.max(1, s.rollupEveryDays);
  let day = lastRollup ? addDaysIso(lastRollup, every) : t.date;
  if (day < t.date) day = t.date;
  // Already sent today: the next one is a full interval on.
  if (lastRollup === t.date) day = addDaysIso(t.date, every);
  // Today and the hour has passed: the next hourly run sends it.
  if (day === t.date && t.hour >= s.sendHourIst) return atIst(t.date, t.hour + 1 > 23 ? 23 : t.hour + 1);
  return atIst(day, s.sendHourIst);
}

/** When the next leadership digest goes, or null while it is off. */
export function nextDigestAt(s: ScheduleSettings, lastDigest: string | null, now: Date = new Date()): string | null {
  if (!s.digestEnabled) return null;
  const t = istNow(now);
  for (let i = 0; i <= 7; i++) {
    const day = addDaysIso(t.date, i);
    if (weekdayOf(day) !== s.digestWeekday) continue;
    if (day === lastDigest) continue;
    if (i === 0 && t.hour >= s.digestHourIst) return atIst(day, t.hour + 1 > 23 ? 23 : t.hour + 1);
    return atIst(day, s.digestHourIst);
  }
  return null;
}
