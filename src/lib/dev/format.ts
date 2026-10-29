/**
 * Plain dates and sizes for the developer console (R-29): "14 Oct", "14 Oct, 09:12",
 * "2.4 MB". Times are shown in India time, the firm's clock.
 */

const TZ = 'Asia/Kolkata';

function parts(iso: string, withSeconds = false) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined,
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? '';
  return { day: get('day'), month: get('month'), year: get('year'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

/** "14 Oct" (with the year when it is not this year). */
export function day(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return '-';
  const p = parts(iso);
  if (!p) return '-';
  const thisYear = parts(now.toISOString())?.year;
  return p.year === thisYear ? `${p.day} ${p.month}` : `${p.day} ${p.month} ${p.year}`;
}

/** "14 Oct, 09:12". */
export function stamp(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return '-';
  const p = parts(iso);
  if (!p) return '-';
  return `${day(iso, now)}, ${p.hour}:${p.minute}`;
}

/** "14 Oct, 09:12:05", for log lines. */
export function stampSec(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return '-';
  const p = parts(iso, true);
  if (!p) return '-';
  return `${day(iso, now)}, ${p.hour}:${p.minute}:${p.second}`;
}

/** "1 min 20 s", "45 s", "-" between two times. */
export function duration(startIso: string | null | undefined, endIso: string | null | undefined): string {
  if (!startIso || !endIso) return '-';
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '-';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${s % 60} s`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

/** "2.4 MB" from bytes. */
export function bytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / 1024 ** i;
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

/** "$12.40" or "12.40 EUR". */
export function money(amount: number, currency: string): string {
  const v = amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency === 'USD' ? `$${v}` : `${v} ${currency}`;
}

/** Whole days from now until `iso` (negative when past). */
export function daysUntil(iso: string, now = new Date()): number {
  return Math.round((new Date(iso).getTime() - now.getTime()) / 86400000);
}

/** "OPERATION_IN_PROGRESS" or "operation_in_progress" becomes "Operation in progress". */
export function words(raw: string): string {
  const t = raw.replace(/_/g, ' ').trim().toLowerCase();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : raw;
}

/**
 * The version part of an image name for the home card chip: the tag after ":" ("2026.10.21"),
 * or the first 12 hex digits of a digest ("sha256:4f2a…" becomes "4f2a9c1d0b7e"). Null when
 * there is no tag.
 */
export function imageVersion(image: string | null | undefined): string | null {
  if (!image) return null;
  const digest = /@sha256:([0-9a-f]{12})/i.exec(image);
  if (digest) return digest[1];
  const i = image.lastIndexOf(':');
  return i > 0 && i < image.length - 1 ? image.slice(i + 1) : null;
}
