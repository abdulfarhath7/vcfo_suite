/**
 * Plain labels for Profile › Devices signed in (G-25): "Chrome on Windows",
 * "14 Oct", "Active now". Pure, so the rules are tested without a browser.
 */

/** Browser and system from a user agent, for example "Safari on iPhone". */
export function describeUserAgent(ua: string | null | undefined): string {
  const s = (ua ?? '').trim();
  if (!s) return 'Unknown device';
  const browser = /Edg\//.test(s)
    ? 'Edge'
    : /OPR\/|Opera/.test(s)
      ? 'Opera'
      : /Firefox\/|FxiOS/.test(s)
        ? 'Firefox'
        : /Chrome\/|CriOS/.test(s)
          ? 'Chrome'
          : /Safari\//.test(s)
            ? 'Safari'
            : null;
  const system = /iPhone/.test(s)
    ? 'iPhone'
    : /iPad/.test(s)
      ? 'iPad'
      : /Android/.test(s)
        ? 'Android'
        : /Windows/.test(s)
          ? 'Windows'
          : /Mac OS X|Macintosh/.test(s)
            ? 'Mac'
            : /CrOS/.test(s)
              ? 'ChromeOS'
              : /Linux/.test(s)
                ? 'Linux'
                : null;
  if (browser && system) return `${browser} on ${system}`;
  return browser ?? system ?? 'Unknown device';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "14 Oct", or "14 Oct 2025" when the year is not the current one. India time. */
export function shortDate(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const ist = new Date(d.getTime() + 330 * 60_000);
  const nowIst = new Date(now.getTime() + 330 * 60_000);
  const base = `${ist.getUTCDate()} ${MONTHS[ist.getUTCMonth()]}`;
  return ist.getUTCFullYear() === nowIst.getUTCFullYear() ? base : `${base} ${ist.getUTCFullYear()}`;
}

/**
 * When a device was last used. Last seen is written at most every five minutes,
 * so anything within ten minutes reads as "Active now".
 */
export function lastSeenLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const mins = Math.floor((now.getTime() - d.getTime()) / 60_000);
  if (mins < 10) return 'Active now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return shortDate(iso, now);
}
